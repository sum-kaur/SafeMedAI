# SafeMedAI - Product Requirements Document

## Original Problem Statement
Build a production-style full-stack web application called "SafeMedAI" that helps reduce medication-related harm for seniors aged 65+ after hospital discharge. The app allows users to upload hospital discharge summaries (photos, screenshots, PDFs), extracts medication and discharge information via AI, analyzes the case using a configurable ACB medication risk scoring engine, and classifies patients as Low/Medium/High risk with role-based recommendations.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **AI**: OpenAI GPT-4o (via emergentintegrations) for OCR extraction and Q&A
- **Auth**: Emergent Google OAuth
- **Storage**: Emergent Object Storage for file uploads
- **Scoring Engine**: ACB (Anticholinergic Cognitive Burden) - configurable

## User Personas
1. **Medical Practitioners** - GPs, pharmacists, nurse practitioners, care coordinators
2. **Family/Carers** - Adult children, spouses, informal carers
3. **Admin** - System configuration (future)

## Core Requirements
- Google OAuth authentication with role-based access
- Patient profile CRUD management
- File upload (drag-drop, PDF/image) to object storage
- OCR extraction via OpenAI Vision API
- ACB Risk Scoring Engine (configurable, Low/Medium/High)
- Role-based recommendations (clinical vs plain-language)
- Conversational Q&A grounded in patient documents
- Alerts system for medium/high risk cases
- Dashboard with risk summary statistics
- Clinical safety disclaimers throughout
- Seed data for demo mode

## What's Been Implemented (2026-04-11)
- [x] Landing page with hero, feature cards, how-it-works section
- [x] Google OAuth via Emergent Auth
- [x] Role selection (medical_practitioner / family_carer)
- [x] Patient CRUD (create, list, view, update)
- [x] File upload to Emergent Object Storage
- [x] Document processing pipeline (OpenAI Vision for images, PyPDF2 for PDFs)
- [x] ACB Risk Scoring Engine with 50+ medication entries
- [x] Role-based recommendations engine
- [x] Risk results page with score card, medications table, flagged meds, recommendations
- [x] Conversational Q&A with safety guardrails
- [x] Alerts system with read/unread management
- [x] Dashboard with stats, risk summary, recent patients
- [x] Sidebar navigation
- [x] Seed data (3 patients: low/medium/high risk scenarios)
- [x] Clinical disclaimers on all result pages

## Prioritized Backlog

### P0 (Critical)
- None remaining for MVP

### P1 (High)
- Report export/download as PDF
- Admin configuration page for scoring engine thresholds
- Patient profile editing from profile page
- Audit logging display

### P2 (Medium)
- Settings page (notification preferences, profile settings)
- Multiple scoring engine support (swap ACB for other frameworks)
- Duplicate file detection
- Mobile camera capture integration
- Email/SMS notification stubs

### P3 (Low)
- Admin user management
- Care relationship management
- Trend widgets on dashboard
- Search and filter on all lists
- Export functionality for all data

## Next Tasks
1. Add PDF report export feature
2. Build admin configuration page for scoring thresholds
3. Add patient profile edit capability from profile page
4. Implement audit log viewer
5. Add notification preference settings
