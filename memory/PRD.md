# SafeMedAI - Product Requirements Document

## Original Problem Statement
Production-style full-stack web application that helps reduce medication-related harm for seniors aged 65+ after hospital discharge via configurable medication risk scoring, document extraction, and role-based recommendations.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB + Emergent Object Storage + OpenAI Vision (gpt-4o)
- **Auth**: Emergent Google OAuth
- **Email**: Resend (configurable)
- **Scoring Engines**: ACB, DBI, Sedative Load (all configurable)

## All Implemented Features (2026-04-11)

### Core MVP
- [x] Landing page, Google OAuth, role selection (practitioner / family_carer)
- [x] Patient CRUD with inline editing
- [x] File upload (drag-drop + mobile camera capture) to object storage
- [x] Document processing (OpenAI Vision for images, PyPDF2 for PDFs)
- [x] ACB + DBI + Sedative Load multi-engine risk scoring
- [x] Role-based recommendations, conversational Q&A, alerts, dashboard
- [x] Seed data (3 patients: low/medium/high risk)

### Advanced Features
- [x] PDF Report Export/Download
- [x] Admin Scoring Engine Config (thresholds + medication DB per engine)
- [x] Audit Log Viewer + Notification Settings
- [x] Email notifications via Resend (graceful fallback)
- [x] Report History Comparison (A/B side-by-side with medication diff)
- [x] Data Export: CSV for patients, risk results, medications
- [x] Care Relationship Management (link practitioners/carers to patients)

## Deployment Status: READY
