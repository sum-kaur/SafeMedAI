# SafeMedAI

**AI-powered medication safety decision support for seniors after hospital discharge.**

SafeMedAI reduces medication-related harm for patients aged 65+ by extracting medications from discharge summaries and scoring them using evidence-based clinical risk engines (ACB, DBI, Sedative Load). It provides role-specific guidance for medical practitioners and family carers.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Deployment](#deployment)

---

## Features

- **Document extraction** — Upload a discharge summary photo or PDF; AI extracts medications, diagnoses, and discharge instructions
- **Risk scoring** — Three configurable clinical engines: Anticholinergic Cognitive Burden (ACB), Drug Burden Index (DBI), Sedative Load
- **Role-based dashboards** — Dense control-room view for practitioners; plain-language view for family carers
- **Clinical Q&A** — Ask questions about the discharge summary, grounded in the uploaded documents
- **Alerts & notifications** — Email alerts (via Resend) when high or medium risk is detected
- **Report history** — Compare risk results across multiple uploads
- **Patient management** — Add, search, and manage patients with linked care relationships
- **Admin panel** — Configure scoring engines, medication databases, and audit logs
- **Demo mode** — Works fully without an OpenAI key using built-in fallback extraction and scoring

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router 7, Tailwind CSS 3, Shadcn/UI, Recharts |
| **Backend** | FastAPI, Python 3.11+, Motor (async MongoDB) |
| **Database** | MongoDB (local or Atlas) |
| **AI** | OpenAI GPT-4o (Vision + Chat) — optional, graceful fallback |
| **Email** | Resend — optional |
| **Build** | CRACO (CRA override), Yarn |

---

## Prerequisites

Make sure you have the following installed:

| Tool | Minimum version | Check |
|---|---|---|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Yarn | 1.22+ | `yarn --version` |
| MongoDB | 6+ (local) **or** a free [Atlas](https://cloud.mongodb.com) cluster | — |
| Git | any | `git --version` |

> **MongoDB Atlas (recommended for quick start):** Sign up free at [cloud.mongodb.com](https://cloud.mongodb.com), create a cluster, and copy the connection string. No local installation needed.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/sum-kaur/SafeMedAI.git
cd SafeMedAI

# 2. Backend setup
cd backend
python -m venv venv

# Activate venv
source venv/bin/activate          # macOS / Linux
# OR
.\venv\Scripts\activate           # Windows (Command Prompt)
# OR
venv\Scripts\Activate.ps1         # Windows (PowerShell)

pip install -r requirements.txt

# 3. Configure backend environment
cp .env .env.local                # copy the example env (already committed as .env)
# Edit .env and fill in your MONGO_URL (see Environment Variables below)

# 4. Frontend setup (in a new terminal)
cd ../frontend
yarn install

# 5. Start both servers (see Running the App below)
```

---

## Environment Variables

### Backend — `backend/.env`

```env
# ─── Required ────────────────────────────────────────────────
MONGO_URL=mongodb://127.0.0.1:27017          # Local MongoDB
# MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/  # Atlas

DB_NAME=safemed_dev                          # Database name (created automatically)

# ─── Optional — AI extraction (app works without this) ───────
OPENAI_API_KEY=sk-...                        # OpenAI API key for GPT-4o Vision
OPENAI_API_BASE=https://api.openai.com/v1   # Change if using a proxy/OpenRouter
LLM_MODEL=gpt-4o                            # Model for text extraction & chat

# ─── Optional — Email alerts (skipped if not set) ────────────
RESEND_API_KEY=re_...                        # Resend.com API key
SENDER_EMAIL=alerts@yourdomain.com           # From address for email alerts

# ─── Optional — Scoring engine ───────────────────────────────
SCORING_ENGINE=ACB                           # ACB | DBI | SEDLOAD

# ─── Optional — Security (for production) ────────────────────
CORS_ORIGINS=http://localhost:3000           # Comma-separated allowed origins
COOKIE_SECURE=false                          # Set true behind HTTPS
COOKIE_SAMESITE=lax                          # lax | strict | none
```

**Minimum required to run:** `MONGO_URL` and `DB_NAME`. Everything else is optional.

### Frontend — `frontend/.env`

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

This file is already committed and configured for local development. No changes needed unless your backend runs on a different port.

---

## Running the App

Open **two terminals** — one for the backend and one for the frontend.

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate      # or .\venv\Scripts\activate on Windows

uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Backend is now running at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd frontend
yarn start
```

Frontend is now running at: `http://localhost:3000`

Open `http://localhost:3000` in your browser and use one of the [demo accounts](#demo-accounts) to log in.

---

## Demo Accounts

No sign-up required. The landing page has instant demo login buttons.

| Role | Access | Button |
|---|---|---|
| **Medical Practitioner** | Full clinical dashboard, all patients, risk scores, Q&A, admin | "Practitioner Demo" |
| **Family / Carer** | Simplified view, plain-language explanations, action prompts | "Family Demo" |

You can also seed sample patient data from inside the dashboard by clicking **"Load Demo Data"**.

---

## Project Structure

```
SafeMedAI/
├── backend/
│   ├── server.py            # FastAPI application (all routes + business logic)
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Environment variables (not committed with real keys)
│   └── storage/             # Local file storage for uploaded documents
│
├── frontend/
│   ├── public/
│   │   └── index.html       # HTML entry point
│   ├── src/
│   │   ├── App.js           # Router + layout
│   │   ├── index.css        # Global styles + CSS variables (design tokens)
│   │   ├── contexts/
│   │   │   └── AuthContext.js   # Auth state (login, logout, demo login)
│   │   ├── components/
│   │   │   ├── Sidebar.js       # Navigation sidebar
│   │   │   ├── ProtectedRoute.js
│   │   │   └── ui/              # Shadcn/UI component library
│   │   ├── pages/
│   │   │   ├── LandingPage.js   # Public landing page
│   │   │   ├── Dashboard.js     # Main dashboard (practitioner + family views)
│   │   │   ├── PatientsPage.js  # Patient list + add patient
│   │   │   ├── PatientProfile.js
│   │   │   ├── UploadPage.js    # Document upload (photo / PDF)
│   │   │   ├── RiskResults.js   # Risk score display + recommendations
│   │   │   ├── ChatPage.js      # AI Q&A interface
│   │   │   ├── AlertsPage.js
│   │   │   ├── AdminPage.js     # Scoring engine config
│   │   │   ├── SettingsPage.js
│   │   │   └── ReportHistory.js
│   │   └── hooks/
│   │       └── use-toast.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── craco.config.js
│
├── README.md
└── DEVELOPMENT_SETUP.md
```

---

## API Reference

The full interactive API docs are available at `http://localhost:8000/docs` when the backend is running.

Key endpoint groups:

| Prefix | Description |
|---|---|
| `POST /api/auth/demo-login` | Create a demo session (no credentials needed) |
| `GET /api/auth/me` | Check current session |
| `GET /api/dashboard/stats` | Dashboard summary stats |
| `GET/POST /api/patients` | List and create patients |
| `POST /api/upload/{patient_id}` | Upload a document (image or PDF) |
| `POST /api/process/{document_id}` | Extract medications + calculate risk score |
| `GET /api/risk-results/{patient_id}` | Get risk results for a patient |
| `POST /api/chat/{patient_id}/messages` | Send a chat message (Q&A) |
| `GET /api/alerts` | Get unread alerts |
| `POST /api/seed` | Seed demo patient data |
| `GET /api/export/patients` | Download patient list as CSV |

---

## Deployment

### Environment checklist for production

- Set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=strict` (requires HTTPS)
- Set `CORS_ORIGINS` to your frontend domain only
- Use a MongoDB Atlas connection string (not `127.0.0.1`)
- Add a real `OPENAI_API_KEY` to enable AI extraction and chat
- Add `RESEND_API_KEY` + `SENDER_EMAIL` to enable email alerts

### Running in production

**Backend:**
```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 2
```

**Frontend:**
```bash
cd frontend
yarn build
# Serve the build/ folder with any static host (Nginx, Vercel, Netlify, etc.)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes and push
4. Open a pull request against `main`

---

## Disclaimer

SafeMedAI provides **decision support information only** and does not replace professional medical judgment. Always consult a qualified healthcare professional for medical advice regarding medications.
