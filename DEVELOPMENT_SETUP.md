# SafeMed AI Development Setup

## Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB (local or cloud instance)

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Windows
pip install -r requirements.txt
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

### 3. Environment Configuration

#### Backend (.env)
Update `backend/.env` with your MongoDB connection string and API keys:
```
MONGO_URL=your_mongodb_connection_string
DB_NAME=safemed_dev
EMERGENT_LLM_KEY=your_emergent_key
RESEND_API_KEY=your_resend_key
```

#### Frontend (.env)
The frontend .env is already configured for local development.

### 4. Database Setup
- For local MongoDB: Install MongoDB Community Server
- For cloud MongoDB: Use MongoDB Atlas (free tier available)

### 5. Running the Application

#### Backend
```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Testing
Run the backend tests:
```bash
cd backend
.\venv\Scripts\activate
python backend_test.py
```