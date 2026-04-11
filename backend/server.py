from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Query, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import base64
import requests as http_requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================== OBJECT STORAGE ========================
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "safemedai"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ======================== AUTH HELPERS ========================
async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ======================== ACB SCORING ENGINE ========================
SCORING_ENGINE = os.environ.get("SCORING_ENGINE", "ACB")

ACB_MEDICATIONS = {
    "amitriptyline": 3, "atropine": 3, "chlorpheniramine": 3, "chlorpromazine": 3,
    "clomipramine": 3, "clozapine": 3, "desipramine": 3, "dicyclomine": 3,
    "diphenhydramine": 3, "doxepin": 3, "hydroxyzine": 3, "hyoscine": 3,
    "imipramine": 3, "meclizine": 3, "nortriptyline": 3, "olanzapine": 3,
    "orphenadrine": 3, "oxybutynin": 3, "paroxetine": 3, "perphenazine": 3,
    "promethazine": 3, "quetiapine": 3, "thioridazine": 3, "tolterodine": 3,
    "trifluoperazine": 3, "trimipramine": 3, "scopolamine": 3,
    "amantadine": 2, "baclofen": 2, "carbamazepine": 2, "cetirizine": 2,
    "cimetidine": 2, "cyclobenzaprine": 2, "loperamide": 2, "loratadine": 2,
    "meperidine": 2, "nifedipine": 2, "ranitidine": 2,
    "alprazolam": 1, "aripiprazole": 1, "atenolol": 1, "codeine": 1,
    "colchicine": 1, "diazepam": 1, "digoxin": 1, "fentanyl": 1,
    "furosemide": 1, "haloperidol": 1, "hydralazine": 1, "isosorbide": 1,
    "metoprolol": 1, "morphine": 1, "prednisone": 1, "risperidone": 1,
    "theophylline": 1, "tramadol": 1, "trazodone": 1, "warfarin": 1,
}

ACB_THRESHOLDS = {"low": (0, 2), "medium": (3, 5), "high": (6, 999)}

def calculate_acb_score(medications: list):
    total_score = 0
    risk_factors = []
    for med in medications:
        name = med.get("name", "").lower().strip()
        for acb_med, score in ACB_MEDICATIONS.items():
            if acb_med in name:
                total_score += score
                risk_factors.append({
                    "medication": med.get("name", name),
                    "acb_score": score,
                    "level": "definite" if score == 3 else "clinically_relevant" if score == 2 else "potential"
                })
                break
    risk_level = "low"
    for level, (lo, hi) in ACB_THRESHOLDS.items():
        if lo <= total_score <= hi:
            risk_level = level
            break
    return {"total_score": total_score, "risk_level": risk_level, "risk_factors": risk_factors,
            "medication_count": len(medications), "flagged_count": len(risk_factors)}

def generate_recommendations(risk_result: dict, role: str):
    risk_level = risk_result["risk_level"]
    recs = []
    if role == "medical_practitioner":
        if risk_level == "high":
            recs = [
                {"type": "urgent", "text": "Urgent medication review recommended within 48 hours"},
                {"type": "action", "text": "Consider pharmacist-led medication reconciliation"},
                {"type": "action", "text": "Review anticholinergic burden - deprescribing assessment needed (clinician review required)"},
                {"type": "action", "text": "Assess for anticholinergic side effects: confusion, falls risk, urinary retention, dry mouth"},
                {"type": "flag", "text": "Multiple high-ACB medications identified - polypharmacy review indicated"},
            ]
        elif risk_level == "medium":
            recs = [
                {"type": "action", "text": "GP medication review recommended within 1-2 weeks"},
                {"type": "action", "text": "Consider pharmacist medication reconciliation at next visit"},
                {"type": "flag", "text": "Monitor for anticholinergic side effects"},
                {"type": "info", "text": "Review if all current medications are still clinically indicated"},
            ]
        else:
            recs = [
                {"type": "info", "text": "Low anticholinergic burden identified"},
                {"type": "action", "text": "Routine medication review at next GP visit"},
                {"type": "info", "text": "Continue standard post-discharge follow-up plan"},
            ]
    else:
        if risk_level == "high":
            recs = [
                {"type": "urgent", "text": "Please book a GP appointment as soon as possible (within 2 days)"},
                {"type": "action", "text": "Request a medication review from your pharmacist"},
                {"type": "action", "text": "Contact the hospital discharge team if you have concerns"},
                {"type": "warning", "text": "Watch for: unusual confusion, drowsiness, falls, difficulty passing urine"},
                {"type": "info", "text": "Call 000 (emergency) or health advice line if symptoms worsen suddenly"},
            ]
        elif risk_level == "medium":
            recs = [
                {"type": "action", "text": "Book a GP appointment within the next 1-2 weeks"},
                {"type": "action", "text": "Ask your pharmacist to check all current medications"},
                {"type": "info", "text": "Keep a list of all medications and bring it to your GP visit"},
                {"type": "info", "text": "Note any new symptoms and discuss them with your doctor"},
            ]
        else:
            recs = [
                {"type": "info", "text": "The medication risk appears low based on available information"},
                {"type": "action", "text": "Attend your scheduled follow-up GP appointment"},
                {"type": "info", "text": "Keep all medications as directed unless told otherwise by your doctor"},
            ]
    return recs

# ======================== PYDANTIC MODELS ========================
class RoleUpdate(BaseModel):
    role: str

class PatientCreate(BaseModel):
    name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact: Optional[str] = None
    gp_details: Optional[str] = None
    allergies: Optional[List[str]] = []
    medical_history: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact: Optional[str] = None
    gp_details: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_history: Optional[str] = None

class ChatMessage(BaseModel):
    message: str

# ======================== AUTH ROUTES ========================
@api_router.post("/auth/session")
async def exchange_session(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    try:
        resp = http_requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    email = data.get("email")
    name = data.get("name")
    picture = data.get("picture")
    session_token = data.get("session_token")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "role": None, "created_at": datetime.now(timezone.utc).isoformat()
        })
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    response = JSONResponse(content=user)
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*3600)
    return response

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key="session_token", path="/")
    return response

# ======================== USER ROUTES ========================
@api_router.put("/users/role")
async def update_role(body: RoleUpdate, request: Request):
    user = await get_current_user(request)
    if body.role not in ["medical_practitioner", "family_carer", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": body.role}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated

# ======================== PATIENT ROUTES ========================
@api_router.get("/patients")
async def list_patients(request: Request):
    user = await get_current_user(request)
    patients = await db.patients.find(
        {"$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return patients

@api_router.post("/patients")
async def create_patient(body: PatientCreate, request: Request):
    user = await get_current_user(request)
    patient_id = f"pat_{uuid.uuid4().hex[:12]}"
    doc = {
        "patient_id": patient_id, "name": body.name, "dob": body.dob, "gender": body.gender,
        "emergency_contact": body.emergency_contact, "gp_details": body.gp_details,
        "allergies": body.allergies or [], "medical_history": body.medical_history,
        "created_by": user["user_id"], "linked_users": [user["user_id"]],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.patients.insert_one(doc)
    created = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    return created

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, request: Request):
    user = await get_current_user(request)
    patient = await db.patients.find_one(
        {"patient_id": patient_id, "$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]},
        {"_id": 0}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    documents = await db.documents.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    risk_results = await db.risk_results.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    alerts = await db.alerts.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"patient": patient, "documents": documents, "risk_results": risk_results, "alerts": alerts}

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, body: PatientUpdate, request: Request):
    user = await get_current_user(request)
    patient = await db.patients.find_one(
        {"patient_id": patient_id, "$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]},
        {"_id": 0}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.patients.update_one({"patient_id": patient_id}, {"$set": updates})
    updated = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    return updated

# ======================== FILE UPLOAD ROUTES ========================
@api_router.post("/upload/{patient_id}")
async def upload_files(patient_id: str, request: Request, files: List[UploadFile] = File(...)):
    user = await get_current_user(request)
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    batch_id = f"batch_{uuid.uuid4().hex[:12]}"
    uploaded = []
    for file in files:
        ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
        storage_path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
        data = await file.read()
        try:
            result = put_object(storage_path, data, file.content_type or "application/octet-stream")
            doc_id = f"doc_{uuid.uuid4().hex[:12]}"
            doc = {
                "document_id": doc_id, "patient_id": patient_id, "upload_batch_id": batch_id,
                "storage_path": result["path"], "original_filename": file.filename,
                "content_type": file.content_type, "size": result.get("size", len(data)),
                "status": "uploaded", "created_by": user["user_id"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.documents.insert_one(doc)
            doc.pop("_id", None)
            uploaded.append(doc)
        except Exception as e:
            logger.error(f"Upload error for {file.filename}: {e}")
            uploaded.append({"original_filename": file.filename, "status": "error", "error": str(e)})
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "upload", "resource_type": "document", "resource_id": batch_id,
        "details": f"Uploaded {len(uploaded)} files for patient {patient_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"batch_id": batch_id, "documents": uploaded}

@api_router.get("/files/{path:path}")
async def download_file(path: str, request: Request, auth: str = Query(None)):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
        elif auth:
            session_token = auth
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    record = await db.documents.find_one({"storage_path": path}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))

# ======================== DOCUMENT PROCESSING ========================
@api_router.post("/process/{document_id}")
async def process_document(document_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"document_id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.documents.update_one({"document_id": document_id}, {"$set": {"status": "processing"}})
    try:
        data, content_type = get_object(doc["storage_path"])
        extracted_text = ""
        if "pdf" in (content_type or "").lower() or doc.get("original_filename", "").lower().endswith(".pdf"):
            import PyPDF2
            import io
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
            parsed = await extract_with_llm(extracted_text, is_text=True)
        else:
            image_base64 = base64.b64encode(data).decode('utf-8')
            parsed = await extract_with_llm(image_base64, is_text=False)
        summary_id = f"sum_{uuid.uuid4().hex[:12]}"
        summary = {
            "summary_id": summary_id, "document_id": document_id, "patient_id": doc["patient_id"],
            **parsed, "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.parsed_summaries.insert_one(summary)
        await db.documents.update_one({"document_id": document_id}, {"$set": {"status": "processed", "summary_id": summary_id}})
        medications = parsed.get("medications", [])
        risk = calculate_acb_score(medications)
        result_id = f"risk_{uuid.uuid4().hex[:12]}"
        risk_result = {
            "result_id": result_id, "patient_id": doc["patient_id"],
            "document_ids": [document_id], "scoring_engine": SCORING_ENGINE,
            **risk,
            "explanation": generate_explanation(risk),
            "recommendations_practitioner": generate_recommendations(risk, "medical_practitioner"),
            "recommendations_family": generate_recommendations(risk, "family_carer"),
            "confidence": parsed.get("confidence", 0.5),
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.risk_results.insert_one(risk_result)
        if risk["risk_level"] in ["medium", "high"]:
            alert = {
                "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                "patient_id": doc["patient_id"], "user_id": user["user_id"],
                "result_id": result_id,
                "type": "risk_assessment",
                "severity": risk["risk_level"],
                "title": f"{'High' if risk['risk_level']=='high' else 'Medium'} medication risk detected",
                "message": f"ACB score of {risk['total_score']} detected for this patient. {risk['flagged_count']} medications flagged.",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.alerts.insert_one(alert)
        summary.pop("_id", None)
        risk_result.pop("_id", None)
        return {"summary": summary, "risk_result": risk_result}
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        await db.documents.update_one({"document_id": document_id}, {"$set": {"status": "error", "error": str(e)}})
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

def generate_explanation(risk: dict):
    level = risk["risk_level"]
    score = risk["total_score"]
    flagged = risk["flagged_count"]
    total = risk["medication_count"]
    if level == "high":
        return f"This patient has a high Anticholinergic Cognitive Burden (ACB) score of {score}. {flagged} out of {total} medications have anticholinergic properties. High ACB scores are associated with increased risk of cognitive decline, confusion, falls, and other adverse effects in older adults. Urgent clinical review is recommended."
    elif level == "medium":
        return f"This patient has a moderate ACB score of {score}. {flagged} out of {total} medications have some anticholinergic properties. A medication review is recommended to assess whether any medications can be adjusted to reduce the anticholinergic burden."
    else:
        return f"This patient has a low ACB score of {score}. {flagged} out of {total} medications have mild anticholinergic properties. Standard post-discharge follow-up is appropriate."

async def extract_with_llm(content: str, is_text: bool = False):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    system_msg = """You are a medical document extraction system. Extract structured information from hospital discharge summaries. Return ONLY valid JSON with these fields:
{
  "patient_name": "string or null",
  "discharge_date": "string or null",
  "diagnosis": "string or null",
  "medications": [{"name": "string", "dose": "string or null", "frequency": "string or null", "route": "string or null", "is_new": true/false, "is_ceased": false, "is_changed": false}],
  "new_medications": ["medication names"],
  "ceased_medications": ["medication names"],
  "changed_doses": [{"name": "string", "old_dose": "string", "new_dose": "string"}],
  "discharge_instructions": "string or null",
  "follow_up": "string or null",
  "allergies": ["string"],
  "confidence": 0.0-1.0
}
Be accurate. Do not hallucinate information not present in the document. If a field cannot be determined, use null. Return ONLY the JSON object."""
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"ocr-{uuid.uuid4().hex[:8]}",
        system_message=system_msg
    )
    chat.with_model("openai", "gpt-4o")
    if is_text:
        msg = UserMessage(text=f"Extract structured discharge summary data from this text:\n\n{content}")
    else:
        image_content = ImageContent(image_base64=content)
        msg = UserMessage(
            text="Extract structured discharge summary data from this hospital discharge document image.",
            file_contents=[image_content]
        )
    response = await chat.send_message(msg)
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM response: {text[:500]}")
        return {"medications": [], "confidence": 0.1, "raw_text": text,
                "patient_name": None, "discharge_date": None, "diagnosis": None,
                "new_medications": [], "ceased_medications": [], "changed_doses": [],
                "discharge_instructions": None, "follow_up": None, "allergies": []}

# ======================== RISK RESULTS ========================
@api_router.get("/risk-results/{patient_id}")
async def get_risk_results(patient_id: str, request: Request):
    await get_current_user(request)
    results = await db.risk_results.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return results

@api_router.get("/risk-results/{patient_id}/latest")
async def get_latest_risk(patient_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.risk_results.find_one({"patient_id": patient_id}, {"_id": 0}, sort=[("created_at", -1)])
    if not result:
        return {"message": "No risk results found"}
    summary = await db.parsed_summaries.find_one(
        {"patient_id": patient_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    role = user.get("role", "family_carer")
    recommendations = result.get(f"recommendations_{role}", result.get("recommendations_family", []))
    return {"risk_result": result, "parsed_summary": summary, "recommendations": recommendations}

# ======================== CHAT / Q&A ========================
@api_router.get("/chat/{patient_id}/messages")
async def get_chat_messages(patient_id: str, request: Request):
    await get_current_user(request)
    messages = await db.conversation_messages.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return messages

@api_router.post("/chat/{patient_id}/messages")
async def send_chat_message(patient_id: str, body: ChatMessage, request: Request):
    user = await get_current_user(request)
    role = user.get("role", "family_carer")
    summaries = await db.parsed_summaries.find({"patient_id": patient_id}, {"_id": 0}).to_list(10)
    risk_results = await db.risk_results.find({"patient_id": patient_id}, {"_id": 0}).to_list(5)
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    context_parts = []
    if patient:
        context_parts.append(f"Patient: {patient.get('name')}, Allergies: {patient.get('allergies', [])}")
    for s in summaries:
        context_parts.append(f"Discharge Summary - Diagnosis: {s.get('diagnosis')}, Medications: {json.dumps(s.get('medications', []))}, Instructions: {s.get('discharge_instructions')}, Follow-up: {s.get('follow_up')}")
    for r in risk_results:
        context_parts.append(f"Risk Assessment - Score: {r.get('total_score')}, Level: {r.get('risk_level')}, Factors: {json.dumps(r.get('risk_factors', []))}")
    context = "\n".join(context_parts)
    prev_messages = await db.conversation_messages.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    prev_messages.reverse()
    history = "\n".join([f"{'User' if m['role']=='user' else 'Assistant'}: {m['content']}" for m in prev_messages])
    guardrails = ""
    if role == "family_carer":
        guardrails = """IMPORTANT GUARDRAILS FOR FAMILY/CARER:
- Never provide medication cessation or dosage change instructions
- Never provide specific medical diagnoses
- Always recommend consulting a doctor/pharmacist for medication questions
- If asked dangerous questions, redirect to emergency services or clinician
- Use plain, simple language
- Focus on what actions to take (book GP, call pharmacist) not clinical details"""
    else:
        guardrails = """IMPORTANT GUARDRAILS FOR PRACTITIONER:
- Provide clinical decision support only
- Do not make definitive diagnosis or treatment decisions
- Always recommend clinical review for medication changes
- Flag uncertainty clearly"""
    system_msg = f"""You are SafeMedAI, a medication safety decision support assistant. You answer questions ONLY about this patient's uploaded discharge documents and risk assessment results.

DISCLAIMER: This tool provides decision support only and does not replace professional medical judgment.

PATIENT CONTEXT:
{context}

PREVIOUS CONVERSATION:
{history}

{guardrails}

Provide helpful, accurate answers grounded in the patient's data. Cite specific medications or findings when relevant. If information is not available in the data, say so honestly."""

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"chat-{uuid.uuid4().hex[:8]}", system_message=system_msg)
    chat.with_model("openai", "gpt-4o")
    ai_response = await chat.send_message(UserMessage(text=body.message))
    user_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}", "patient_id": patient_id,
        "user_id": user["user_id"], "role": "user", "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    ai_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}", "patient_id": patient_id,
        "user_id": "system", "role": "assistant", "content": ai_response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conversation_messages.insert_many([user_msg, ai_msg])
    user_msg.pop("_id", None)
    ai_msg.pop("_id", None)
    return {"user_message": user_msg, "ai_message": ai_msg}

# ======================== ALERTS ========================
@api_router.get("/alerts")
async def get_alerts(request: Request):
    user = await get_current_user(request)
    patients = await db.patients.find(
        {"$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]},
        {"_id": 0, "patient_id": 1}
    ).to_list(100)
    patient_ids = [p["patient_id"] for p in patients]
    alerts = await db.alerts.find(
        {"patient_id": {"$in": patient_ids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return alerts

@api_router.put("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, request: Request):
    await get_current_user(request)
    await db.alerts.update_one({"alert_id": alert_id}, {"$set": {"read": True}})
    return {"message": "Alert marked as read"}

# ======================== DASHBOARD ========================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    patients = await db.patients.find(
        {"$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]},
        {"_id": 0}
    ).to_list(100)
    patient_ids = [p["patient_id"] for p in patients]
    total_patients = len(patients)
    total_docs = await db.documents.count_documents({"patient_id": {"$in": patient_ids}})
    risk_results = await db.risk_results.find({"patient_id": {"$in": patient_ids}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    high_risk = sum(1 for r in risk_results if r.get("risk_level") == "high")
    medium_risk = sum(1 for r in risk_results if r.get("risk_level") == "medium")
    low_risk = sum(1 for r in risk_results if r.get("risk_level") == "low")
    unread_alerts = await db.alerts.count_documents({"patient_id": {"$in": patient_ids}, "read": False})
    recent_results = risk_results[:5]
    recent_patients = patients[:5]
    return {
        "total_patients": total_patients, "total_documents": total_docs,
        "high_risk": high_risk, "medium_risk": medium_risk, "low_risk": low_risk,
        "unread_alerts": unread_alerts, "recent_results": recent_results,
        "recent_patients": recent_patients
    }

# ======================== SEED DATA ========================
@api_router.post("/seed")
async def seed_data(request: Request):
    user = await get_current_user(request)
    existing = await db.patients.count_documents({"created_by": user["user_id"]})
    if existing > 0:
        return {"message": "Seed data already exists", "patient_count": existing}
    patients = [
        {
            "patient_id": f"pat_seed_{uuid.uuid4().hex[:8]}", "name": "Margaret Thompson",
            "dob": "1947-03-15", "gender": "Female",
            "emergency_contact": "John Thompson (Son) - 0412 345 678",
            "gp_details": "Dr Sarah Wilson - Greenfield Medical Centre",
            "allergies": ["Penicillin"], "medical_history": "Type 2 Diabetes, Hypertension",
            "created_by": user["user_id"], "linked_users": [user["user_id"]],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "patient_id": f"pat_seed_{uuid.uuid4().hex[:8]}", "name": "Robert Chen",
            "dob": "1943-09-22", "gender": "Male",
            "emergency_contact": "Lisa Chen (Daughter) - 0423 456 789",
            "gp_details": "Dr Michael Park - Eastside Family Practice",
            "allergies": ["Sulfonamides", "Codeine"], "medical_history": "Chronic pain, Anxiety, Heart failure, Insomnia",
            "created_by": user["user_id"], "linked_users": [user["user_id"]],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "patient_id": f"pat_seed_{uuid.uuid4().hex[:8]}", "name": "Dorothy Williams",
            "dob": "1950-12-08", "gender": "Female",
            "emergency_contact": "Mary Williams (Daughter) - 0434 567 890",
            "gp_details": "Dr James Patel - Riverside Health Clinic",
            "allergies": [], "medical_history": "Overactive bladder, Depression, Insomnia, Chronic pain, GERD",
            "created_by": user["user_id"], "linked_users": [user["user_id"]],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.patients.insert_many(patients)
    summaries_data = [
        {
            "patient_idx": 0,
            "meds": [
                {"name": "Aspirin", "dose": "100mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Metformin", "dose": "500mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Lisinopril", "dose": "10mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Atorvastatin", "dose": "20mg", "frequency": "nightly", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Chest pain - investigation. Cardiac enzymes normal. Discharged with stable angina management.",
            "discharge_instructions": "Continue current medications. New statin added for cholesterol management. Low-salt diet.",
            "follow_up": "GP review in 2 weeks. Pathology for HbA1c in 4 weeks.",
            "confidence": 0.92,
        },
        {
            "patient_idx": 1,
            "meds": [
                {"name": "Diazepam", "dose": "5mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Furosemide", "dose": "40mg", "frequency": "morning", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Cetirizine", "dose": "10mg", "frequency": "daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Metoprolol", "dose": "50mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Tramadol", "dose": "50mg", "frequency": "as needed", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Acute exacerbation of heart failure. Stabilised with IV diuretics. Allergic rhinitis treated.",
            "discharge_instructions": "Weigh daily. Report weight gain >2kg. Fluid restriction 1.5L/day. New antihistamine for rhinitis.",
            "follow_up": "Heart failure clinic in 1 week. GP review in 2 weeks.",
            "confidence": 0.87,
        },
        {
            "patient_idx": 2,
            "meds": [
                {"name": "Amitriptyline", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Oxybutynin", "dose": "5mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Quetiapine", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Diphenhydramine", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Promethazine", "dose": "25mg", "frequency": "as needed", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Omeprazole", "dose": "20mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Fall with confusion. CT head normal. Likely medication-related cognitive impairment. New quetiapine for agitation.",
            "discharge_instructions": "Monitor for confusion, drowsiness, falls. Medication review urgently recommended. Falls prevention.",
            "follow_up": "GP review within 48 hours. Geriatrician referral recommended. Pharmacist medication reconciliation.",
            "confidence": 0.90,
        },
    ]
    for sd in summaries_data:
        p = patients[sd["patient_idx"]]
        doc_id = f"doc_seed_{uuid.uuid4().hex[:8]}"
        await db.documents.insert_one({
            "document_id": doc_id, "patient_id": p["patient_id"], "upload_batch_id": f"batch_seed_{uuid.uuid4().hex[:8]}",
            "storage_path": f"seed/demo_{doc_id}.pdf", "original_filename": f"discharge_summary_{p['name'].replace(' ','_').lower()}.pdf",
            "content_type": "application/pdf", "size": 0, "status": "processed",
            "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
        })
        summary_id = f"sum_seed_{uuid.uuid4().hex[:8]}"
        await db.parsed_summaries.insert_one({
            "summary_id": summary_id, "document_id": doc_id, "patient_id": p["patient_id"],
            "patient_name": p["name"], "discharge_date": "2026-02-01",
            "diagnosis": sd["diagnosis"], "medications": sd["meds"],
            "new_medications": [m["name"] for m in sd["meds"] if m.get("is_new")],
            "ceased_medications": [], "changed_doses": [],
            "discharge_instructions": sd["discharge_instructions"],
            "follow_up": sd["follow_up"], "allergies": p.get("allergies", []),
            "confidence": sd["confidence"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        risk = calculate_acb_score(sd["meds"])
        result_id = f"risk_seed_{uuid.uuid4().hex[:8]}"
        risk_result = {
            "result_id": result_id, "patient_id": p["patient_id"],
            "document_ids": [doc_id], "scoring_engine": SCORING_ENGINE,
            **risk,
            "explanation": generate_explanation(risk),
            "recommendations_practitioner": generate_recommendations(risk, "medical_practitioner"),
            "recommendations_family": generate_recommendations(risk, "family_carer"),
            "confidence": sd["confidence"], "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.risk_results.insert_one(risk_result)
        if risk["risk_level"] in ["medium", "high"]:
            await db.alerts.insert_one({
                "alert_id": f"alert_seed_{uuid.uuid4().hex[:8]}",
                "patient_id": p["patient_id"], "user_id": user["user_id"],
                "result_id": result_id, "type": "risk_assessment", "severity": risk["risk_level"],
                "title": f"{'High' if risk['risk_level']=='high' else 'Medium'} medication risk - {p['name']}",
                "message": f"ACB score of {risk['total_score']} detected. {risk['flagged_count']} medications flagged.",
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
    return {"message": "Demo data seeded successfully", "patients": [p["patient_id"] for p in patients]}

# ======================== REPORT ========================
@api_router.get("/reports/{result_id}")
async def get_report(result_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.risk_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    patient = await db.patients.find_one({"patient_id": result["patient_id"]}, {"_id": 0})
    summary = await db.parsed_summaries.find_one({"patient_id": result["patient_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    documents = await db.documents.find({"document_id": {"$in": result.get("document_ids", [])}}, {"_id": 0}).to_list(10)
    role = user.get("role", "family_carer")
    recommendations = result.get(f"recommendations_{role}", result.get("recommendations_family", []))
    return {
        "report": {
            "patient": patient, "risk_result": result, "parsed_summary": summary,
            "documents": documents, "recommendations": recommendations,
            "generated_by": user["name"], "generated_at": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "This report provides decision support information only and does not replace professional medical judgment. Always consult a qualified healthcare professional for medical advice."
        }
    }

# ======================== APP CONFIG ========================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object storage initialized successfully")
    except Exception as e:
        logger.error(f"Storage init failed (will retry on first use): {e}")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("patient_id", unique=True)
    await db.documents.create_index("document_id", unique=True)
    await db.risk_results.create_index("result_id", unique=True)
    logger.info("SafeMedAI backend started")

@app.on_event("shutdown")
async def shutdown():
    client.close()
