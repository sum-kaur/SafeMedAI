from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Query, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
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
from fpdf import FPDF
import io
import asyncio
import csv
from io import StringIO
import re
import openai

# Resend email (graceful if not configured)
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    import resend
    resend.api_key = RESEND_API_KEY

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
# GridFS for file storage (Railway/Docker-compatible)
fs = AsyncIOMotorGridFSBucket(db, bucket_name="fs")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================== OBJECT STORAGE (GridFS) ========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_API_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "minimax/minimax-m2.5:free")
APP_NAME = "safemedai"

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")
SESSION_COOKIE_NAME = "session_token"

openai_client = None
if OPENAI_API_KEY:
    openai_client = openai.OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_API_BASE)

async def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Store file in GridFS. Path is used as filename metadata."""
    try:
        file_id = await fs.upload_from_stream(path, data, content_type=content_type)
        return {"path": path, "file_id": str(file_id), "size": len(data), "content_type": content_type}
    except Exception as e:
        logger.error(f"GridFS put error: {e}")
        raise

async def get_object(path: str):
    """Retrieve file from GridFS by filename (path).

    Gracefully handles legacy local file references by returning a clear error.
    """
    try:
        file_doc = await db.fs.files.find_one({"filename": path})
        if not file_doc:
            # Check if this looks like a legacy local storage path
            if path.startswith("safemedai/") or "uploads" in path:
                raise FileNotFoundError(
                    f"File '{path}' was stored in local storage which is not available in this deployment. "
                    f"This file was uploaded before GridFS storage was configured."
                )
            raise FileNotFoundError(f"Storage object not found: {path}")
        grid_out = await fs.open_download_stream(file_doc["_id"])
        data = await grid_out.read()
        return data, file_doc.get("contentType") or file_doc.get("content_type")
    except FileNotFoundError:
        raise
    except Exception as e:
        logger.error(f"GridFS get error: {e}")
        raise

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

# ======================== ACB SCORING ========================
ACTIVE_ENGINE = "ACB"

ENGINES_REGISTRY = {
    "ACB": {
        "name": "ACB",
        "full_name": "Anticholinergic Cognitive Burden",
        "description": "Scores medications by their anticholinergic properties. Higher ACB burden is linked to cognitive decline, confusion, and falls in older adults.",
        "medications": {
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
        },
        "thresholds": {"low": [0, 2], "medium": [3, 5], "high": [6, 999]},
        "score_labels": {3: "definite", 2: "clinically_relevant", 1: "potential"},
    },
}

# In-memory scoring caches per engine
_scoring_caches = {}

async def load_scoring_config():
    for engine_name, defaults in ENGINES_REGISTRY.items():
        config = await db.scoring_config.find_one({"engine": engine_name}, {"_id": 0})
        if config:
            _scoring_caches[engine_name] = {
                "medications": config.get("medications", dict(defaults["medications"])),
                "thresholds": config.get("thresholds", dict(defaults["thresholds"])),
            }
        else:
            _scoring_caches[engine_name] = {
                "medications": dict(defaults["medications"]),
                "thresholds": dict(defaults["thresholds"]),
            }
            await db.scoring_config.update_one(
                {"engine": engine_name},
                {"$set": {
                    "engine": engine_name,
                    "medications": dict(defaults["medications"]),
                    "thresholds": dict(defaults["thresholds"]),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
    logger.info(f"Loaded {len(_scoring_caches)} ACB calculator config")

def calculate_risk_score(medications: list, engine_name: str = None):
    engine = engine_name or ACTIVE_ENGINE
    cache = _scoring_caches.get(engine, _scoring_caches.get("ACB", {}))
    meds_table = cache.get("medications", {})
    thresholds = cache.get("thresholds", {"low": [0, 2], "medium": [3, 5], "high": [6, 999]})
    defaults = ENGINES_REGISTRY.get(engine, ENGINES_REGISTRY["ACB"])
    score_labels = defaults.get("score_labels", {3: "definite", 2: "clinically_relevant", 1: "potential"})

    total_score = 0
    risk_factors = []
    for med in medications:
        name = med.get("name", "").lower().strip()
        for tbl_med, score in meds_table.items():
            if tbl_med in name:
                total_score += score
                risk_factors.append({
                    "medication": med.get("name", name),
                    "score": score,
                    "level": score_labels.get(score, "unknown")
                })
                break
    risk_level = "low"
    for level, bounds in thresholds.items():
        lo, hi = bounds[0], bounds[1]
        if lo <= total_score <= hi:
            risk_level = level
            break
    return {"total_score": total_score, "risk_level": risk_level, "risk_factors": risk_factors,
            "medication_count": len(medications), "flagged_count": len(risk_factors),
            "scoring_engine": engine}

# ======================== EMAIL SERVICE ========================
async def send_risk_notification_email(user_email: str, user_name: str, patient_name: str, risk_level: str, total_score: int, engine: str):
    if not RESEND_API_KEY:
        logger.info(f"Email not configured: would notify {user_email} about {risk_level} risk for {patient_name}")
        return {"status": "skipped", "reason": "RESEND_API_KEY not configured"}
    risk_colors = {"high": "#BA5A45", "medium": "#D9944C", "low": "#4E876C"}
    color = risk_colors.get(risk_level, "#5C6661")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:16px;background:#1E3A5F;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">SafeMedAI Alert</h1>
      </div>
      <div style="padding:24px;background:#FAF9F6;border:1px solid #E6E4DE;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#1F2421;font-size:16px;">Hello {user_name},</p>
        <div style="background:{color}15;border:2px solid {color};border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
          <p style="color:{color};font-size:24px;font-weight:bold;margin:0;">{risk_level.upper()} RISK</p>
          <p style="color:{color};margin:4px 0 0 0;">{engine} Score: {total_score}</p>
        </div>
        <p style="color:#5C6661;">A medication risk assessment for <strong>{patient_name}</strong> has been completed with a <strong>{risk_level}</strong> risk level.</p>
        <p style="color:#5C6661;">Please log in to SafeMedAI to review the full assessment, recommendations, and next steps.</p>
        <hr style="border:none;border-top:1px solid #E6E4DE;margin:20px 0;">
        <p style="color:#8A938E;font-size:11px;text-align:center;">This is a decision support notification only. It does not replace professional medical judgment. SafeMedAI.</p>
      </div>
    </div>"""
    try:
        import resend
        params = {"from": SENDER_EMAIL, "to": [user_email], "subject": f"SafeMedAI: {risk_level.upper()} Risk Alert - {patient_name}", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {user_email}: {result}")
        return {"status": "sent", "email_id": result.get("id") if isinstance(result, dict) else str(result)}
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return {"status": "error", "error": str(e)}

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
                {"type": "resource", "text": "Refer to Amsterdam UMC medication withdrawal decision tree for evidence-based tapering guidance", "url": "https://kiktools.amsterdamumc.org/falls/decision-tree/"},
            ]
        elif risk_level == "medium":
            recs = [
                {"type": "action", "text": "GP medication review recommended within 1-2 weeks"},
                {"type": "action", "text": "Consider pharmacist medication reconciliation at next visit"},
                {"type": "flag", "text": "Monitor for anticholinergic side effects"},
                {"type": "info", "text": "Review if all current medications are still clinically indicated"},
                {"type": "resource", "text": "Consult Amsterdam UMC withdrawal guidelines for fall-risk medication classes", "url": "https://kiktools.amsterdamumc.org/falls/decision-tree/"},
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
    gp_phone: Optional[str] = None
    allergies: Optional[List[str]] = []
    medical_history: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact: Optional[str] = None
    gp_details: Optional[str] = None
    gp_phone: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_history: Optional[str] = None

class ChatMessage(BaseModel):
    message: str

class ThresholdUpdate(BaseModel):
    low: List[int]
    medium: List[int]
    high: List[int]

class MedicationEntry(BaseModel):
    name: str
    score: int

class NotificationSettings(BaseModel):
    email_high_risk: Optional[bool] = True
    email_medium_risk: Optional[bool] = False
    in_app_high_risk: Optional[bool] = True
    in_app_medium_risk: Optional[bool] = True
    in_app_low_risk: Optional[bool] = False

class CareRelationshipCreate(BaseModel):
    patient_id: str
    user_email: str
    relationship_type: str = "carer"

# ======================== HEALTH CHECK ========================
@api_router.get("/health")
async def health_check():
    """Railway health check endpoint - unauthenticated."""
    return {"ok": True}

# ======================== AUTH ROUTES ========================
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

@api_router.post("/auth/demo-login")
async def demo_login(request: Request, refresh: bool = False):
    body = await request.json()
    role = body.get("role", "medical_practitioner")
    if role not in ["medical_practitioner", "family_carer"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    demo_email = f"demo_{role}@safemedai.app"
    demo_name = "Dr Williams" if role == "medical_practitioner" else "Olivia Taylor"
    existing = await db.users.find_one({"email": demo_email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": demo_email}, {"$set": {"role": role, "name": demo_name}})
    else:
        user_id = f"demo_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": demo_email, "name": demo_name,
            "picture": "", "role": role,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    session_token = f"demo_sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    # Seed demo data once per demo account. Re-seeding on every login makes the
    # Railway demo button slow because it performs multiple deletes/inserts.
    existing_count = await db.patients.count_documents({"created_by": user_id})
    existing_patients = []
    if existing_count:
        for seed_patient in (SEED_DATA_PRACTITIONER if role == "medical_practitioner" else SEED_DATA_FAMILY)["patients"]:
            if seed_patient.get("gp_phone"):
                await db.patients.update_many(
                    {"created_by": user_id, "name": seed_patient["name"], "gp_phone": {"$in": [None, ""]}},
                    {"$set": {"gp_phone": seed_patient["gp_phone"]}}
                )
    if refresh and existing_count:
        existing_patients = await db.patients.find({"created_by": user_id}, {"_id": 0, "patient_id": 1}).to_list(100)
        patient_ids = [p["patient_id"] for p in existing_patients]
        await db.patients.delete_many({"created_by": user_id})
        await db.documents.delete_many({"created_by": user_id})
        await db.parsed_summaries.delete_many({"patient_id": {"$in": patient_ids}})
        await db.risk_results.delete_many({"patient_id": {"$in": patient_ids}})
        await db.alerts.delete_many({"user_id": user_id})
        existing_count = 0
    dataset = SEED_DATA_PRACTITIONER if role == "medical_practitioner" else SEED_DATA_FAMILY
    if not existing_count:
        await _insert_seed_records(user, dataset)

    response = JSONResponse(content=user)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        max_age=7*24*3600
    )
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
        "gp_phone": body.gp_phone,
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
            result = await put_object(storage_path, data, file.content_type or "application/octet-stream")
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
    data, content_type = await get_object(path)
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
        data, content_type = await get_object(doc["storage_path"])
        extracted_text = ""
        filename_lower = doc.get("original_filename", "").lower()
        ct_lower = (content_type or "").lower()
        if "pdf" in ct_lower or filename_lower.endswith(".pdf"):
            import PyPDF2
            import io
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
            parsed = await extract_with_llm(extracted_text, is_text=True)
        elif "text" in ct_lower or filename_lower.endswith(".txt"):
            extracted_text = data.decode("utf-8", errors="replace")
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
        risk = calculate_risk_score(medications)
        result_id = f"risk_{uuid.uuid4().hex[:12]}"
        risk_result = {
            "result_id": result_id, "patient_id": doc["patient_id"],
            "document_ids": [document_id], "scoring_engine": risk["scoring_engine"],
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
                "message": f"{risk['scoring_engine']} score of {risk['total_score']} detected for this patient. {risk['flagged_count']} medications flagged.",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.alerts.insert_one(alert)
            # Send email notification
            notif_settings = await db.notification_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
            should_email = False
            if notif_settings:
                if risk["risk_level"] == "high" and notif_settings.get("email_high_risk"):
                    should_email = True
                elif risk["risk_level"] == "medium" and notif_settings.get("email_medium_risk"):
                    should_email = True
            else:
                should_email = risk["risk_level"] == "high"
            if should_email and user.get("email"):
                patient_data = await db.patients.find_one({"patient_id": doc["patient_id"]}, {"_id": 0})
                email_result = await send_risk_notification_email(
                    user["email"], user.get("name", "User"),
                    patient_data.get("name", "Patient") if patient_data else "Patient",
                    risk["risk_level"], risk["total_score"], risk["scoring_engine"]
                )
                await db.audit_logs.insert_one({
                    "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
                    "action": "email_notification", "resource_type": "risk_result", "resource_id": result_id,
                    "details": f"Email notification: {email_result.get('status')} to {user['email']} for {risk['risk_level']} risk",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
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

def _simple_extract_field(text: str, keys: list[str]) -> Optional[str]:
    for key in keys:
        match = re.search(rf"{re.escape(key)}\s*[:\-]\s*(.+)", text, re.I)
        if match:
            return match.group(1).strip()
    return None


def simple_discharge_extraction(text: str) -> dict:
    patient_name = _simple_extract_field(text, ["Patient Name", "Name"])
    discharge_date = _simple_extract_field(text, ["Discharge Date", "Date of Discharge", "Discharge Date:"])
    diagnosis = _simple_extract_field(text, ["Diagnosis", "Diagnoses", "Assessment"])
    discharge_instructions = _simple_extract_field(text, ["Discharge Instructions", "Instructions"])
    follow_up = _simple_extract_field(text, ["Follow-up", "Follow up", "Follow up instructions"])
    allergy_text = _simple_extract_field(text, ["Allergies", "Allergy"])
    allergies = [a.strip() for a in re.split(r",|;|\n", allergy_text)] if allergy_text else []
    medications = []
    lower_text = text.lower()
    for med in ENGINES_REGISTRY["ACB"]["medications"].keys():
        if med.lower() in lower_text:
            medications.append({
                "name": med,
                "dose": None,
                "frequency": None,
                "route": None,
                "is_new": True,
                "is_ceased": False,
                "is_changed": False
            })
    medications = [dict(t) for t in {tuple(sorted(m.items())) for m in medications}]
    return {
        "patient_name": patient_name,
        "discharge_date": discharge_date,
        "diagnosis": diagnosis,
        "medications": medications,
        "new_medications": [m["name"] for m in medications],
        "ceased_medications": [],
        "changed_doses": [],
        "discharge_instructions": discharge_instructions,
        "follow_up": follow_up,
        "allergies": [a for a in allergies if a],
        "confidence": 0.5
    }

async def extract_with_llm(content: str, is_text: bool = False):
    _empty = {
        "patient_name": None, "discharge_date": None, "diagnosis": None,
        "medications": [], "new_medications": [], "ceased_medications": [],
        "changed_doses": [], "discharge_instructions": None, "follow_up": None,
        "allergies": [], "confidence": 0.2
    }
    if not OPENAI_API_KEY or not openai_client:
        return simple_discharge_extraction(content) if is_text else _empty

    system_msg = (
        "You are a medical document extraction system. Extract structured medication and care information from hospital "
        "discharge summaries, personal medication lists, nursing home or group home medication charts, and dispensing history documents. Return ONLY valid JSON with these fields:\n"
        '{"patient_name": "string or null", "discharge_date": "string or null", "diagnosis": "string or null", '
        '"medications": [{"name": "string", "dose": "string or null", "frequency": "string or null", '
        '"route": "string or null", "is_new": true, "is_ceased": false, "is_changed": false}], '
        '"new_medications": ["medication names"], "ceased_medications": ["medication names"], '
        '"changed_doses": [{"name": "string", "old_dose": "string", "new_dose": "string"}], '
        '"discharge_instructions": "string or null", "follow_up": "string or null", '
        '"allergies": ["string"], "confidence": 0.0}\n'
        "Be accurate. Do not hallucinate. If a field cannot be determined, use null. Return ONLY the JSON object."
    )

    try:
        if is_text:
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"Extract structured medication document data from this text. The source may be a discharge summary, personal medication list, nursing home/group home chart, or dispensing history:\n\n{content}"}
            ]
        else:
            # Image — use Vision API
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{content}"}},
                    {"type": "text", "text": "Extract structured medication document data from this image. The source may be a discharge summary, personal medication list, nursing home/group home chart, or dispensing history."}
                ]}
            ]
        response = await asyncio.to_thread(
            openai_client.chat.completions.create,
            model=LLM_MODEL if is_text else "gpt-4o",
            messages=messages,
            temperature=0.0,
            max_tokens=1200
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return simple_discharge_extraction(content) if is_text else _empty

async def generate_chat_response(system_msg: str, user_message: str) -> str:
    if OPENAI_API_KEY and openai_client:
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_message}
        ]
        try:
            response = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model=LLM_MODEL,
                messages=messages,
                temperature=0.2,
                max_tokens=800
            )
            content = response.choices[0].message.content.strip()
            return content
        except Exception as e:
            logger.error(f"OpenAI chat failed: {e}")

    text = user_message.strip().lower()
    if "medication" in text or "dose" in text or "drug" in text:
        return "This local SafeMedAI instance is running in fallback mode. For medication-specific guidance, please consult a clinician."
    if "risk" in text or "score" in text:
        return "I can summarize the available patient data, but this local setup does not provide full LLM decision support."
    return "This is a local SafeMedAI fallback response. Full LLM integration is not configured for local development."

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
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    return {"risk_result": result, "parsed_summary": summary, "recommendations": recommendations, "patient": patient}

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
        context_parts.append(f"Medication Documents - Diagnosis: {s.get('diagnosis')}, Medications: {json.dumps(s.get('medications', []))}, Instructions: {s.get('discharge_instructions')}, Follow-up: {s.get('follow_up')}")
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

    ai_response = await generate_chat_response(system_msg, body.message)
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
    # Enrich recent patients with latest risk level
    for p in recent_patients:
        latest = await db.risk_results.find_one(
            {"patient_id": p["patient_id"]}, {"_id": 0, "risk_level": 1, "total_score": 1, "scoring_engine": 1},
            sort=[("created_at", -1)]
        )
        p["latest_risk_level"] = latest.get("risk_level") if latest else None
        p["latest_risk_score"] = latest.get("total_score") if latest else None
    return {
        "total_patients": total_patients, "total_documents": total_docs,
        "high_risk": high_risk, "medium_risk": medium_risk, "low_risk": low_risk,
        "unread_alerts": unread_alerts, "recent_results": recent_results,
        "recent_patients": recent_patients
    }

# ======================== SEED DATA ========================
# Role-specific datasets so practitioner and family carer see completely different patients.

SEED_DATA_PRACTITIONER = {
    "patients": [
        {
            "name": "Patricia Nguyen", "dob": "1946-04-12", "gender": "Female",
            "emergency_contact": "James Nguyen (Son) - 0411 234 567",
            "gp_details": "Dr Anita Sharma - Northside Family Practice",
            "gp_phone": "03 9123 4567",
            "allergies": ["Penicillin"], "medical_history": "Overactive bladder, Depression, Chronic low back pain, Insomnia, GERD",
        },
        {
            "name": "Harold Okafor", "dob": "1942-11-03", "gender": "Male",
            "emergency_contact": "Grace Okafor (Wife) - 0422 345 678",
            "gp_details": "Dr Thomas Liu - Central Medical Group",
            "gp_phone": "03 9234 5678",
            "allergies": ["Sulfonamides"], "medical_history": "Heart failure (HFrEF), AF, Chronic pain, Anxiety disorder",
        },
        {
            "name": "Beverley O'Brien", "dob": "1954-07-29", "gender": "Female",
            "emergency_contact": "Sean O'Brien (Husband) - 0433 456 789",
            "gp_details": "Dr Priya Patel - Riverside Health Clinic",
            "gp_phone": "03 9345 6789",
            "allergies": [], "medical_history": "Type 2 Diabetes, Hypertension, Mild depression",
        },
        {
            "name": "Clive Papadopoulos", "dob": "1950-02-14", "gender": "Male",
            "emergency_contact": "Elena Papadopoulos (Wife) - 0444 567 890",
            "gp_details": "Dr Marcus Webb - Eastside Family Practice",
            "gp_phone": "03 9456 7890",
            "allergies": [], "medical_history": "Hypertension, Hyperlipidaemia, Mild osteoarthritis",
        },
        {
            "name": "Shirley Mahmoud", "dob": "1957-09-18", "gender": "Female",
            "emergency_contact": "Omar Mahmoud (Son) - 0455 678 901",
            "gp_details": "Dr Sarah Wilson - Greenfield Medical Centre",
            "gp_phone": "03 9567 8901",
            "allergies": ["Codeine"], "medical_history": "Insomnia, GERD, Chronic back pain, Mild anxiety",
        },
        {
            "name": "Victor Osei", "dob": "1951-08-14", "gender": "Male",
            "emergency_contact": "Abena Osei (Wife) - 0466 789 012",
            "gp_details": "Dr Helen Park - Southgate Medical Centre",
            "gp_phone": "03 9678 9012",
            "allergies": [], "medical_history": "Coronary artery disease (post-CABG 2019), Hypertension, Hypercholesterolaemia, Type 2 Diabetes (diet-controlled)",
        },
    ],
    "summaries": [
        # Patricia Nguyen — HIGH risk (ACB 10: amitriptyline 3 + oxybutynin 3 + promethazine 3 + metoclopramide 1)
        {
            "patient_idx": 0,
            "meds": [
                {"name": "Amitriptyline", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Oxybutynin", "dose": "5mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Promethazine", "dose": "25mg", "frequency": "as needed for nausea", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Metoclopramide", "dose": "10mg", "frequency": "three times daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Omeprazole", "dose": "20mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Fall with acute confusion and urinary retention. CT head normal. Likely anticholinergic toxidrome. Metoclopramide added for nausea.",
            "discharge_instructions": "Monitor for confusion, drowsiness and falls. Urgent pharmacist medication review required due to high anticholinergic burden. Consider deprescribing oxybutynin and amitriptyline.",
            "follow_up": "GP review within 48 hours. Geriatric medicine referral recommended. Pharmacist medication reconciliation urgently required.",
            "confidence": 0.93,
        },
        # Harold Okafor — HIGH risk (Diazepam sedative + tramadol + quetiapine)
        {
            "patient_idx": 1,
            "meds": [
                {"name": "Diazepam", "dose": "5mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Furosemide", "dose": "40mg", "frequency": "morning", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Metoprolol", "dose": "50mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Spironolactone", "dose": "25mg", "frequency": "daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Tramadol", "dose": "50mg", "frequency": "four times daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Quetiapine", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Acute decompensated heart failure (NYHA III). Optimised with IV diuresis. Quetiapine added for acute agitation. Tramadol added for chronic pain.",
            "discharge_instructions": "Weigh daily — report weight gain >2 kg to GP immediately. Fluid restriction 1.5 L/day. Low sodium diet. Avoid alcohol.",
            "follow_up": "Heart failure clinic in 1 week. GP review in 2 weeks. Echocardiogram booked. Review diazepam and tramadol at follow-up.",
            "confidence": 0.88,
        },
        # Beverley O'Brien — MEDIUM risk (paroxetine ACB 2 + cetirizine ACB 2)
        {
            "patient_idx": 2,
            "meds": [
                {"name": "Paroxetine", "dose": "20mg", "frequency": "morning", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Cetirizine", "dose": "10mg", "frequency": "daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Metformin", "dose": "1g", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Perindopril", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Aspirin", "dose": "100mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Atorvastatin", "dose": "40mg", "frequency": "nightly", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Poorly controlled Type 2 Diabetes with HbA1c 9.2%. Hypertension managed. Cetirizine commenced for seasonal allergic rhinitis.",
            "discharge_instructions": "Statin therapy started — monitor LFTs in 3 months. Blood glucose diary. DASH diet reinforced. Smoking cessation support offered.",
            "follow_up": "GP review in 2 weeks. Fasting BSL and HbA1c in 6 weeks. Podiatry referral for diabetic foot care.",
            "confidence": 0.91,
        },
        # Clive Papadopoulos — LOW risk
        {
            "patient_idx": 3,
            "meds": [
                {"name": "Amlodipine", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Perindopril", "dose": "10mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Atorvastatin", "dose": "40mg", "frequency": "nightly", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Aspirin", "dose": "100mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Elective right total knee replacement. Uncomplicated recovery. Good pain control achieved.",
            "discharge_instructions": "Wound care as instructed. DVT prophylaxis completed. Weight bearing as tolerated with physiotherapy guidance.",
            "follow_up": "Orthopaedic outpatient review at 2 weeks. GP review at 1 week for wound check. Physiotherapy 3x/week.",
            "confidence": 0.95,
        },
        # Shirley Mahmoud — MEDIUM risk (temazepam sedative + zopiclone)
        {
            "patient_idx": 4,
            "meds": [
                {"name": "Temazepam", "dose": "10mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Omeprazole", "dose": "20mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Ibuprofen", "dose": "400mg", "frequency": "three times daily with food", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Diazepam", "dose": "2mg", "frequency": "twice daily as needed", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Lower back pain exacerbation with associated anxiety. Short course diazepam commenced. Ibuprofen continued with gastroprotection.",
            "discharge_instructions": "Diazepam for short-term use only (max 2 weeks). Avoid driving while taking benzodiazepines. Physiotherapy referral made. Sleep hygiene advice given.",
            "follow_up": "GP review in 1 week to reassess benzodiazepine use. Physiotherapy referral. Consider weaning temazepam at next review.",
            "confidence": 0.86,
        },
        # Victor Osei — LOW risk (stable cardiac, no anticholinergic burden)
        {
            "patient_idx": 5,
            "meds": [
                {"name": "Warfarin", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Bisoprolol", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Perindopril", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Atorvastatin", "dose": "40mg", "frequency": "nightly", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Aspirin", "dose": "100mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Elective cataract surgery (right eye), uncomplicated. Background: stable coronary artery disease post-CABG 2019. Warfarin continued perioperatively under haematology guidance.",
            "discharge_instructions": "Eye drops as charted for 4 weeks. Avoid rubbing eye. No heavy lifting for 2 weeks. Continue all cardiac medications unchanged. INR check in 5 days.",
            "follow_up": "Ophthalmology review at 1 week. GP for INR check in 5 days. Cardiology annual review due October 2026.",
            "confidence": 0.97,
        },
    ],
}

SEED_DATA_FAMILY = {
    "patients": [
        {
            "name": "June Walsh", "dob": "1948-03-14", "gender": "Female",
            "emergency_contact": "Olivia Taylor (Daughter) - 0412 111 222",
            "gp_details": "Dr Kevin Barrett - Hillside Medical Centre",
            "gp_phone": "03 9789 0123",
            "allergies": [], "medical_history": "Alzheimer's dementia (moderate), Urinary incontinence, Hypertension, Osteoporosis, History of falls",
        },
        {
            "name": "Brian Walsh", "dob": "1945-11-27", "gender": "Male",
            "emergency_contact": "Olivia Taylor (Daughter) - 0412 111 222",
            "gp_details": "Dr Kevin Barrett - Hillside Medical Centre",
            "gp_phone": "03 9789 0123",
            "allergies": ["Penicillin"], "medical_history": "Chronic heart failure (HFpEF), Type 2 Diabetes, Osteoarthritis both knees, Mild CKD",
        },
    ],
    "summaries": [
        # June Walsh — HIGH risk (dementia + anticholinergics: oxybutynin, diphenhydramine, haloperidol)
        {
            "patient_idx": 0,
            "meds": [
                {"name": "Oxybutynin", "dose": "5mg", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Haloperidol", "dose": "0.5mg", "frequency": "at night", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Diphenhydramine", "dose": "25mg", "frequency": "at night", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Perindopril", "dose": "4mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Calcium + Vitamin D", "dose": "600mg/400IU", "frequency": "twice daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "500mg", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Behavioural and Psychological Symptoms of Dementia — acute agitation and nocturnal wandering. Haloperidol added at low dose. June was admitted after a fall at home.",
            "discharge_instructions": "Haloperidol should be reviewed and ceased within 12 weeks if possible. Watch for increased drowsiness, confusion, or further falls. Oxybutynin may worsen memory — discuss with GP at next visit. Ensure home is safe (remove trip hazards, install grab rails).",
            "follow_up": "GP review within 72 hours. Memory clinic follow-up in 2 weeks. Carer support referral completed. Pharmacist medication review requested.",
            "confidence": 0.89,
        },
        # Brian Walsh — MEDIUM risk (tramadol + heart failure medications)
        {
            "patient_idx": 1,
            "meds": [
                {"name": "Furosemide", "dose": "40mg", "frequency": "morning", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Bisoprolol", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Ramipril", "dose": "5mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Tramadol", "dose": "50mg", "frequency": "twice daily", "route": "oral", "is_new": True, "is_ceased": False, "is_changed": False},
                {"name": "Omeprazole", "dose": "20mg", "frequency": "daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
                {"name": "Paracetamol", "dose": "1g", "frequency": "four times daily", "route": "oral", "is_new": False, "is_ceased": False, "is_changed": False},
            ],
            "diagnosis": "Acute-on-chronic heart failure — fluid overload secondary to dietary non-adherence. Stabilised with IV diuresis. Tramadol added for knee osteoarthritis pain on discharge.",
            "discharge_instructions": "Weigh every morning — call the GP if weight increases by more than 2 kg overnight. Limit fluids to 1.5 L per day. Follow a low-salt diet. Take all medications as prescribed. Tramadol may cause drowsiness — do not drive.",
            "follow_up": "GP review in 1 week. Heart failure nurse to call in 3 days. Kidney function blood test in 2 weeks.",
            "confidence": 0.87,
        },
    ],
}

async def _insert_seed_records(user, dataset):
    """Insert patients, summaries, risk results and alerts from a seed dataset dict."""
    patients = []
    for p_data in dataset["patients"]:
        p = {
            "patient_id": f"pat_seed_{uuid.uuid4().hex[:8]}",
            **p_data,
            "created_by": user["user_id"],
            "linked_users": [user["user_id"]],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        patients.append(p)
    await db.patients.insert_many(patients)

    for sd in dataset["summaries"]:
        p = patients[sd["patient_idx"]]
        doc_id = f"doc_seed_{uuid.uuid4().hex[:8]}"
        await db.documents.insert_one({
            "document_id": doc_id, "patient_id": p["patient_id"],
            "upload_batch_id": f"batch_seed_{uuid.uuid4().hex[:8]}",
            "storage_path": f"seed/demo_{doc_id}.txt",
            "original_filename": f"discharge_summary_{p['name'].replace(' ', '_').lower()}.txt",
            "content_type": "text/plain", "size": 0, "status": "processed",
            "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
        })
        summary_id = f"sum_seed_{uuid.uuid4().hex[:8]}"
        await db.parsed_summaries.insert_one({
            "summary_id": summary_id, "document_id": doc_id, "patient_id": p["patient_id"],
            "patient_name": p["name"], "discharge_date": "2026-03-15",
            "diagnosis": sd["diagnosis"], "medications": sd["meds"],
            "new_medications": [m["name"] for m in sd["meds"] if m.get("is_new")],
            "ceased_medications": [], "changed_doses": [],
            "discharge_instructions": sd["discharge_instructions"],
            "follow_up": sd["follow_up"], "allergies": p.get("allergies", []),
            "confidence": sd["confidence"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        risk = calculate_risk_score(sd["meds"])
        result_id = f"risk_seed_{uuid.uuid4().hex[:8]}"
        risk_result = {
            "result_id": result_id, "patient_id": p["patient_id"],
            "document_ids": [doc_id], "scoring_engine": risk["scoring_engine"],
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
                "title": f"{'High' if risk['risk_level']=='high' else 'Medium'} medication risk — {p['name']}",
                "message": f"Score of {risk['total_score']} detected. {risk['flagged_count']} medication(s) flagged.",
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
    return patients

@api_router.post("/seed")
async def seed_data(request: Request, force: bool = False):
    user = await get_current_user(request)
    existing = await db.patients.count_documents({"created_by": user["user_id"]})
    if existing > 0:
        if not force:
            existing_patients = await db.patients.find({"created_by": user["user_id"]}, {"_id": 0, "patient_id": 1}).to_list(100)
            return {"message": "Demo data already loaded", "patients": [p["patient_id"] for p in existing_patients]}
        # force=True: wipe existing demo data and re-seed
        existing_patients = await db.patients.find({"created_by": user["user_id"]}, {"_id": 0, "patient_id": 1}).to_list(100)
        patient_ids = [p["patient_id"] for p in existing_patients]
        await db.patients.delete_many({"created_by": user["user_id"]})
        await db.documents.delete_many({"created_by": user["user_id"]})
        if patient_ids:
            await db.parsed_summaries.delete_many({"patient_id": {"$in": patient_ids}})
            await db.risk_results.delete_many({"patient_id": {"$in": patient_ids}})
        await db.alerts.delete_many({"user_id": user["user_id"]})
    role = user.get("role", "family_carer")
    dataset = SEED_DATA_PRACTITIONER if role == "medical_practitioner" else SEED_DATA_FAMILY
    patients = await _insert_seed_records(user, dataset)
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

@api_router.get("/reports/{result_id}/pdf")
async def generate_pdf_report(result_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.risk_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    patient = await db.patients.find_one({"patient_id": result["patient_id"]}, {"_id": 0})
    summary = await db.parsed_summaries.find_one({"patient_id": result["patient_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    role = user.get("role", "family_carer")
    recommendations = result.get(f"recommendations_{role}", result.get("recommendations_family", []))

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "SafeMedAI Risk Assessment Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, f"Generated: {datetime.now(timezone.utc).strftime('%d %B %Y %H:%M UTC')} | By: {user.get('name', 'Unknown')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # Patient Details
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Patient Details", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Name: {patient.get('name', 'N/A')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Date of Birth: {patient.get('dob', 'N/A')} | Gender: {patient.get('gender', 'N/A')}", new_x="LMARGIN", new_y="NEXT")
    if patient.get('allergies'):
        pdf.cell(0, 6, f"Allergies: {', '.join(patient['allergies'])}", new_x="LMARGIN", new_y="NEXT")
    if patient.get('gp_details'):
        pdf.cell(0, 6, f"GP: {patient['gp_details']}", new_x="LMARGIN", new_y="NEXT")
    if patient.get('emergency_contact'):
        pdf.cell(0, 6, f"Emergency Contact: {patient['emergency_contact']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # Risk Score
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Risk Assessment", new_x="LMARGIN", new_y="NEXT")
    rl = result.get('risk_level', 'unknown').upper()
    if result.get('risk_level') == 'high':
        pdf.set_fill_color(252, 238, 235)
    elif result.get('risk_level') == 'medium':
        pdf.set_fill_color(253, 243, 231)
    else:
        pdf.set_fill_color(232, 240, 236)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(60, 12, f"  {rl} RISK", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"ACB Score: {result.get('total_score', 0)} | Calculator: {result.get('scoring_engine', 'ACB')} | Confidence: {round((result.get('confidence', 0)) * 100)}%", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Medications: {result.get('medication_count', 0)} total, {result.get('flagged_count', 0)} flagged", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Explanation
    if result.get('explanation'):
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5, result['explanation'])
    pdf.ln(6)

    # Medications Table
    if summary and summary.get('medications'):
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Medications", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(59, 112, 98)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(55, 7, "  Medication", fill=True)
        pdf.cell(30, 7, "  Dose", fill=True)
        pdf.cell(35, 7, "  Frequency", fill=True)
        pdf.cell(25, 7, "  ACB", fill=True)
        pdf.cell(25, 7, "  Status", fill=True)
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 9)
        flagged_names = {rf['medication'].lower(): rf['acb_score'] for rf in result.get('risk_factors', [])}
        for i, med in enumerate(summary['medications']):
            if i % 2 == 1:
                pdf.set_fill_color(243, 241, 236)
            else:
                pdf.set_fill_color(255, 255, 255)
            acb = flagged_names.get(med.get('name', '').lower(), 0)
            status = "New" if med.get('is_new') else "Ceased" if med.get('is_ceased') else "Cont."
            pdf.cell(55, 6, f"  {med.get('name', '')[:25]}", fill=True)
            pdf.cell(30, 6, f"  {med.get('dose', '-')}", fill=True)
            pdf.cell(35, 6, f"  {med.get('frequency', '-')[:18]}", fill=True)
            pdf.cell(25, 6, f"  {acb if acb else '-'}", fill=True)
            pdf.cell(25, 6, f"  {status}", fill=True)
            pdf.ln()
        pdf.ln(6)

    # Recommendations
    if recommendations:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Recommendations", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        for rec in recommendations:
            prefix = "[URGENT]" if rec['type'] == 'urgent' else "[ACTION]" if rec['type'] == 'action' else "[INFO]"
            pdf.multi_cell(0, 5, f" {prefix} {rec['text']}")
            pdf.ln(2)
        pdf.ln(4)

    # Discharge Info
    if summary:
        if summary.get('diagnosis') or summary.get('discharge_instructions'):
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, "Medication Document Details", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            if summary.get('diagnosis'):
                pdf.multi_cell(0, 5, f"Diagnosis: {summary['diagnosis']}")
                pdf.ln(2)
            if summary.get('discharge_instructions'):
                pdf.multi_cell(0, 5, f"Instructions: {summary['discharge_instructions']}")
                pdf.ln(2)
            if summary.get('follow_up'):
                pdf.multi_cell(0, 5, f"Follow-Up: {summary['follow_up']}")
            pdf.ln(6)

    # Disclaimer
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 4, "DISCLAIMER: This report provides decision support information only and does not replace professional medical judgment. Always consult a qualified healthcare professional for medical advice. SafeMedAI does not make diagnoses or treatment decisions.")

    # Audit log
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "export_pdf", "resource_type": "risk_result", "resource_id": result_id,
        "details": f"PDF report exported for patient {patient.get('name', 'Unknown')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    filename = f"SafeMedAI_Report_{patient.get('name', 'Patient').replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ======================== ADMIN SCORING CONFIG ========================
@api_router.get("/admin/engines")
async def list_engines(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    engines = []
    for name, info in ENGINES_REGISTRY.items():
        cache = _scoring_caches.get(name, {})
        engines.append({
            "name": name, "full_name": info["full_name"], "description": info["description"],
            "medication_count": len(cache.get("medications", {})),
            "is_active": name == ACTIVE_ENGINE,
        })
    return {"engines": engines, "active_engine": ACTIVE_ENGINE}

@api_router.put("/admin/engines/active")
async def set_active_engine(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    body = await request.json()
    engine_name = body.get("engine")
    if engine_name not in ENGINES_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown engine: {engine_name}. Available: {list(ENGINES_REGISTRY.keys())}")
    global ACTIVE_ENGINE
    ACTIVE_ENGINE = engine_name
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "switch_engine", "resource_type": "scoring_config", "resource_id": engine_name,
        "details": f"Confirmed active calculator as {engine_name} ({ENGINES_REGISTRY[engine_name]['full_name']})",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"Active calculator set to {engine_name}", "active_engine": engine_name}

@api_router.get("/admin/scoring-config")
async def get_scoring_config(request: Request, engine: str = None):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    eng = engine or ACTIVE_ENGINE
    config = await db.scoring_config.find_one({"engine": eng}, {"_id": 0})
    if not config:
        defaults = ENGINES_REGISTRY.get(eng, ENGINES_REGISTRY["ACB"])
        config = {"engine": eng, "medications": dict(defaults["medications"]), "thresholds": dict(defaults["thresholds"])}
    info = ENGINES_REGISTRY.get(eng, {})
    config["full_name"] = info.get("full_name", eng)
    config["description"] = info.get("description", "")
    config["score_labels"] = info.get("score_labels", {})
    return config

@api_router.put("/admin/scoring-config/thresholds")
async def update_thresholds(body: ThresholdUpdate, request: Request, engine: str = None):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    eng = engine or ACTIVE_ENGINE
    new_thresholds = {"low": body.low, "medium": body.medium, "high": body.high}
    await db.scoring_config.update_one(
        {"engine": eng},
        {"$set": {"thresholds": new_thresholds, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    if eng in _scoring_caches:
        _scoring_caches[eng]["thresholds"] = new_thresholds
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "update_thresholds", "resource_type": "scoring_config", "resource_id": eng,
        "details": f"Updated {eng} thresholds: {json.dumps(new_thresholds)}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Thresholds updated", "thresholds": new_thresholds}

@api_router.post("/admin/scoring-config/medications")
async def add_medication_entry(body: MedicationEntry, request: Request, engine: str = None):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    if body.score < 1 or body.score > 3:
        raise HTTPException(status_code=400, detail="Score must be 1, 2, or 3")
    eng = engine or ACTIVE_ENGINE
    name_lower = body.name.lower().strip()
    await db.scoring_config.update_one(
        {"engine": eng},
        {"$set": {f"medications.{name_lower}": body.score, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    if eng in _scoring_caches:
        _scoring_caches[eng]["medications"][name_lower] = body.score
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "add_medication", "resource_type": "scoring_config", "resource_id": name_lower,
        "details": f"Added/updated medication: {body.name} with score {body.score} in {eng}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"Medication '{body.name}' set to score {body.score} in {eng}"}

@api_router.delete("/admin/scoring-config/medications/{name}")
async def remove_medication_entry(name: str, request: Request, engine: str = None):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "medical_practitioner"]:
        raise HTTPException(status_code=403, detail="Admin or practitioner access required")
    eng = engine or ACTIVE_ENGINE
    name_lower = name.lower().strip()
    await db.scoring_config.update_one(
        {"engine": eng},
        {"$unset": {f"medications.{name_lower}": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if eng in _scoring_caches:
        _scoring_caches[eng].get("medications", {}).pop(name_lower, None)
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "remove_medication", "resource_type": "scoring_config", "resource_id": name_lower,
        "details": f"Removed medication: {name} from {eng} scoring table",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"Medication '{name}' removed from {eng} scoring table"}

# ======================== AUDIT LOGS ========================
@api_router.get("/audit-logs")
async def get_audit_logs(request: Request, limit: int = 50, offset: int = 0):
    user = await get_current_user(request)
    query = {}
    if user.get("role") != "admin":
        query["user_id"] = user["user_id"]
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    return {"logs": logs, "total": total}

# ======================== NOTIFICATION SETTINGS ========================
@api_router.get("/settings/notifications")
async def get_notification_settings(request: Request):
    user = await get_current_user(request)
    settings = await db.notification_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not settings:
        settings = {
            "user_id": user["user_id"],
            "email_high_risk": True, "email_medium_risk": False,
            "in_app_high_risk": True, "in_app_medium_risk": True, "in_app_low_risk": False
        }
    return settings

@api_router.put("/settings/notifications")
async def update_notification_settings(body: NotificationSettings, request: Request):
    user = await get_current_user(request)
    updates = body.model_dump()
    updates["user_id"] = user["user_id"]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.notification_settings.update_one(
        {"user_id": user["user_id"]}, {"$set": updates}, upsert=True
    )
    return {"message": "Settings updated", **updates}

# ======================== EMAIL TEST ========================
@api_router.post("/email/test")
async def send_test_email(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    recipient = body.get("email", user.get("email"))
    if not recipient:
        raise HTTPException(status_code=400, detail="No email address available")
    result = await send_risk_notification_email(recipient, user.get("name", "User"), "Test Patient", "medium", 4, ACTIVE_ENGINE)
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "test_email", "resource_type": "email", "resource_id": recipient,
        "details": f"Test email sent to {recipient}: {result.get('status')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return result

@api_router.get("/email/status")
async def email_status(request: Request):
    await get_current_user(request)
    return {"configured": bool(RESEND_API_KEY), "sender": SENDER_EMAIL}

# ======================== REPORT HISTORY & COMPARISON ========================
@api_router.get("/risk-results/{patient_id}/history")
async def get_risk_history(patient_id: str, request: Request):
    user = await get_current_user(request)
    results = await db.risk_results.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for r in results:
        summary = await db.parsed_summaries.find_one(
            {"document_id": {"$in": r.get("document_ids", [])}}, {"_id": 0, "medications": 1, "diagnosis": 1, "discharge_date": 1}
        )
        r["summary_snippet"] = summary if summary else None
    return results

@api_router.get("/risk-results/{patient_id}/compare")
async def compare_risk_results(patient_id: str, request: Request, result_a: str = Query(...), result_b: str = Query(...)):
    user = await get_current_user(request)
    role = user.get("role", "family_carer")
    a = await db.risk_results.find_one({"result_id": result_a, "patient_id": patient_id}, {"_id": 0})
    b = await db.risk_results.find_one({"result_id": result_b, "patient_id": patient_id}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="One or both results not found")
    sum_a = await db.parsed_summaries.find_one({"document_id": {"$in": a.get("document_ids", [])}}, {"_id": 0})
    sum_b = await db.parsed_summaries.find_one({"document_id": {"$in": b.get("document_ids", [])}}, {"_id": 0})
    recs_a = a.get(f"recommendations_{role}", a.get("recommendations_family", []))
    recs_b = b.get(f"recommendations_{role}", b.get("recommendations_family", []))
    # Compute medication diff
    meds_a = {m["name"].lower(): m for m in (sum_a or {}).get("medications", [])}
    meds_b = {m["name"].lower(): m for m in (sum_b or {}).get("medications", [])}
    added = [meds_b[k] for k in meds_b if k not in meds_a]
    removed = [meds_a[k] for k in meds_a if k not in meds_b]
    unchanged = [meds_b[k] for k in meds_b if k in meds_a]
    return {
        "result_a": a, "result_b": b,
        "summary_a": sum_a, "summary_b": sum_b,
        "recommendations_a": recs_a, "recommendations_b": recs_b,
        "medication_diff": {"added": added, "removed": removed, "unchanged": unchanged},
        "score_change": (b.get("total_score", 0) - a.get("total_score", 0)),
        "level_change": {"from": a.get("risk_level"), "to": b.get("risk_level")},
    }

# ======================== DATA EXPORT (CSV) ========================
@api_router.get("/export/patients")
async def export_patients_csv(request: Request):
    user = await get_current_user(request)
    patients = await db.patients.find(
        {"$or": [{"created_by": user["user_id"]}, {"linked_users": user["user_id"]}]}, {"_id": 0}
    ).to_list(500)
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Patient ID", "Name", "DOB", "Gender", "Emergency Contact", "GP Details", "Allergies", "Medical History", "Created"])
    for p in patients:
        writer.writerow([
            p.get("patient_id"), p.get("name"), p.get("dob", ""), p.get("gender", ""),
            p.get("emergency_contact", ""), p.get("gp_details", ""),
            "; ".join(p.get("allergies", [])), p.get("medical_history", ""), p.get("created_at", "")
        ])
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "export_csv", "resource_type": "patients", "resource_id": "all",
        "details": f"Exported {len(patients)} patients to CSV",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="SafeMedAI_Patients_{datetime.now().strftime("%Y%m%d")}.csv"'})

@api_router.get("/export/risk-results/{patient_id}")
async def export_risk_results_csv(patient_id: str, request: Request):
    user = await get_current_user(request)
    results = await db.risk_results.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Result ID", "Date", "Calculator", "Total Score", "Risk Level", "Medications Total", "Flagged", "Confidence", "Flagged Medications"])
    for r in results:
        flagged = "; ".join([f"{rf.get('medication')}(score:{rf.get('score',rf.get('acb_score','?'))})" for rf in r.get("risk_factors", [])])
        writer.writerow([
            r.get("result_id"), r.get("created_at", ""), r.get("scoring_engine", ""),
            r.get("total_score", 0), r.get("risk_level", ""), r.get("medication_count", 0),
            r.get("flagged_count", 0), round((r.get("confidence", 0)) * 100), flagged
        ])
    name = patient.get("name", "Patient") if patient else "Patient"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="SafeMedAI_RiskHistory_{name.replace(" ","_")}_{datetime.now().strftime("%Y%m%d")}.csv"'})

@api_router.get("/export/medications/{patient_id}")
async def export_medications_csv(patient_id: str, request: Request):
    user = await get_current_user(request)
    summaries = await db.parsed_summaries.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Assessment Date", "Medication", "Dose", "Frequency", "Route", "New", "Ceased", "Changed"])
    for s in summaries:
        date = s.get("discharge_date") or s.get("created_at", "")
        for m in s.get("medications", []):
            writer.writerow([
                date, m.get("name", ""), m.get("dose", ""), m.get("frequency", ""),
                m.get("route", ""), m.get("is_new", False), m.get("is_ceased", False), m.get("is_changed", False)
            ])
    name = patient.get("name", "Patient") if patient else "Patient"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="SafeMedAI_Medications_{name.replace(" ","_")}_{datetime.now().strftime("%Y%m%d")}.csv"'})

# ======================== CARE RELATIONSHIPS ========================
@api_router.get("/care-relationships/{patient_id}")
async def get_care_relationships(patient_id: str, request: Request):
    user = await get_current_user(request)
    rels = await db.care_relationships.find({"patient_id": patient_id}, {"_id": 0}).to_list(50)
    for r in rels:
        linked_user = await db.users.find_one({"user_id": r["linked_user_id"]}, {"_id": 0, "name": 1, "email": 1, "role": 1, "picture": 1})
        r["user_info"] = linked_user
    return rels

@api_router.post("/care-relationships")
async def create_care_relationship(body: CareRelationshipCreate, request: Request):
    user = await get_current_user(request)
    patient = await db.patients.find_one({"patient_id": body.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    target_user = await db.users.find_one({"email": body.user_email}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail=f"No user found with email {body.user_email}. They must sign up first.")
    if target_user["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot create relationship with yourself")
    existing = await db.care_relationships.find_one(
        {"patient_id": body.patient_id, "linked_user_id": target_user["user_id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="This user is already linked to this patient")
    rel_id = f"rel_{uuid.uuid4().hex[:12]}"
    rel = {
        "relationship_id": rel_id, "patient_id": body.patient_id,
        "linked_user_id": target_user["user_id"],
        "relationship_type": body.relationship_type,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.care_relationships.insert_one(rel)
    await db.patients.update_one(
        {"patient_id": body.patient_id},
        {"$addToSet": {"linked_users": target_user["user_id"]}}
    )
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "add_care_relationship", "resource_type": "care_relationship", "resource_id": rel_id,
        "details": f"Linked {target_user.get('name', body.user_email)} as {body.relationship_type} for patient {patient.get('name')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    rel.pop("_id", None)
    rel["user_info"] = {"name": target_user.get("name"), "email": target_user.get("email"), "role": target_user.get("role")}
    return rel

@api_router.delete("/care-relationships/{relationship_id}")
async def remove_care_relationship(relationship_id: str, request: Request):
    user = await get_current_user(request)
    rel = await db.care_relationships.find_one({"relationship_id": relationship_id}, {"_id": 0})
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    await db.care_relationships.delete_one({"relationship_id": relationship_id})
    await db.patients.update_one(
        {"patient_id": rel["patient_id"]},
        {"$pull": {"linked_users": rel["linked_user_id"]}}
    )
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "action": "remove_care_relationship", "resource_type": "care_relationship", "resource_id": relationship_id,
        "details": f"Removed care relationship {relationship_id} for patient {rel['patient_id']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Relationship removed"}

# ======================== APP CONFIG ========================
app.include_router(api_router)

# CORS configuration
cors_origins_raw = os.environ.get('CORS_ORIGINS', '')
cors_origins = [origin.strip() for origin in cors_origins_raw.split(',') if origin.strip()] if cors_origins_raw else ['*']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("patient_id", unique=True)
    await db.patients.create_index("created_by")
    await db.patients.create_index("linked_users")
    await db.documents.create_index("document_id", unique=True)
    await db.documents.create_index("created_by")
    await db.documents.create_index("patient_id")
    await db.parsed_summaries.create_index("patient_id")
    await db.risk_results.create_index("result_id", unique=True)
    await db.risk_results.create_index("patient_id")
    await db.alerts.create_index("user_id")
    await db.alerts.create_index("patient_id")
    await db.audit_logs.create_index("created_at")
    await load_scoring_config()
    logger.info("SafeMedAI backend started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

