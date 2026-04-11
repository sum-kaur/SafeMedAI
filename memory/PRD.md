# SafeMedAI - Product Requirements Document

## Original Problem Statement
Build a production-style full-stack web application called "SafeMedAI" that helps reduce medication-related harm for seniors aged 65+ after hospital discharge. The app allows users to upload hospital discharge summaries (photos, screenshots, PDFs), extracts medication and discharge information via AI, analyzes the case using a configurable ACB medication risk scoring engine, and classifies patients as Low/Medium/High risk with role-based recommendations.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **AI**: OpenAI GPT-4o (via emergentintegrations) for OCR extraction and Q&A
- **Auth**: Emergent Google OAuth
- **Storage**: Emergent Object Storage for file uploads
- **Scoring Engine**: ACB (Anticholinergic Cognitive Burden) - configurable via admin page

## User Personas
1. **Medical Practitioners** - GPs, pharmacists, nurse practitioners, care coordinators
2. **Family/Carers** - Adult children, spouses, informal carers
3. **Admin** - System configuration

## What's Been Implemented

### Phase 1 (2026-04-11)
- [x] Landing page with hero, feature cards, how-it-works section
- [x] Google OAuth via Emergent Auth
- [x] Role selection (medical_practitioner / family_carer)
- [x] Patient CRUD (create, list, view, update)
- [x] File upload to Emergent Object Storage
- [x] Document processing pipeline (OpenAI Vision for images, PyPDF2 for PDFs)
- [x] ACB Risk Scoring Engine with 58 medication entries
- [x] Role-based recommendations engine
- [x] Risk results page with score card, medications table, flagged meds, recommendations
- [x] Conversational Q&A with safety guardrails
- [x] Alerts system with read/unread management
- [x] Dashboard with stats, risk summary, recent patients
- [x] Sidebar navigation
- [x] Seed data (3 patients: low/medium/high risk scenarios)
- [x] Clinical disclaimers on all result pages

### Phase 2 (2026-04-11)
- [x] PDF Report Export/Download (fpdf2 backend generation)
- [x] Admin Scoring Engine Configuration (thresholds + medication database CRUD)
- [x] Patient Profile Editing (inline edit with form fields)
- [x] Audit Log Viewer (paginated activity history)
- [x] Notification Settings (email stubs + in-app alert preferences)
- [x] Settings page with tabbed interface
- [x] Scoring config stored in MongoDB (DB-driven, configurable)

## Prioritized Backlog

### P1 (High)
- Multiple scoring engine support (swap ACB for other frameworks)
- Report history / version comparison
- Mobile camera capture integration

### P2 (Medium)
- Duplicate file detection
- Email/SMS notification delivery (currently stub)
- Care relationship management
- Data export (CSV/Excel)

### P3 (Low)
- Admin user management
- Trend widgets on dashboard
- Multi-language support

## Next Tasks
1. Add support for multiple scoring engine frameworks
2. Implement actual email notification delivery
3. Add mobile camera capture for discharge summary photos
4. Build report history comparison view
