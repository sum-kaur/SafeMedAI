# SafeMedAI - Product Requirements Document

## Original Problem Statement
Build a production-style full-stack web application called "SafeMedAI" that helps reduce medication-related harm for seniors aged 65+ after hospital discharge.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI (Outfit/Work Sans fonts, Organic & Earthy theme)
- **Backend**: FastAPI + MongoDB + Emergent Object Storage + OpenAI Vision
- **Auth**: Emergent Google OAuth
- **Email**: Resend (configurable, graceful fallback when not configured)
- **Scoring Engines**: ACB, DBI, Sedative Load (configurable, switchable)

## What's Been Implemented

### Phase 1 - Core MVP (2026-04-11)
- [x] Landing page, Google OAuth, role selection
- [x] Patient CRUD, file upload to object storage
- [x] Document processing (OpenAI Vision for images, PyPDF2 for PDFs)
- [x] ACB Risk Scoring Engine, role-based recommendations
- [x] Risk results display, conversational Q&A, alerts, dashboard
- [x] Seed data (3 patients: low/medium/high risk)

### Phase 2 - Feature Expansion (2026-04-11)
- [x] PDF Report Export/Download
- [x] Admin Scoring Engine Configuration
- [x] Patient Profile Editing
- [x] Audit Log Viewer + Notification Settings

### Phase 3 - Advanced Features (2026-04-11)
- [x] Multiple scoring engines: ACB, DBI (Drug Burden Index), SEDLOAD (Sedative Load)
- [x] Engine switching via admin page with per-engine thresholds and medication databases
- [x] Real email notification delivery via Resend (graceful fallback when not configured)
- [x] Email status indicator and test email functionality
- [x] Mobile camera capture button (capture="environment" for native camera)
- [x] Updated Family & Carer portal image (caucasian mother and daughter)

## Prioritized Backlog
### P1 - Data export (CSV/Excel), Report history comparison
### P2 - Care relationship management, Multi-language support
### P3 - Admin user management, Trend analytics widgets
