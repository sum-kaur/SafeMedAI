#!/usr/bin/env python3
"""
SafeMedAI Backend API Testing Suite
Tests all backend endpoints using the public URL from frontend/.env
"""

import requests
import sys
import json
import time
from datetime import datetime
import base64
import os

# Use the public endpoint from frontend/.env
BASE_URL = "https://discharge-med-check.preview.emergentagent.com/api"

class SafeMedAITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        })
        
    def make_request(self, method, endpoint, data=None, files=None, headers=None):
        """Make HTTP request with session token"""
        url = f"{self.base_url}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            req_headers['Authorization'] = f'Bearer {self.session_token}'
            
        if headers:
            req_headers.update(headers)
            
        if files:
            # Remove Content-Type for file uploads
            req_headers.pop('Content-Type', None)
            
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=req_headers, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=req_headers, timeout=60)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request error for {endpoint}: {str(e)}")
            return None

    def create_test_session(self):
        """Create a test session directly in MongoDB for testing"""
        print("\n🔧 Creating test session...")
        
        # Use mongosh to create test user and session
        timestamp = int(time.time())
        user_id = f"test-user-{timestamp}"
        session_token = f"test_session_{timestamp}"
        
        mongo_script = f"""
        use('test_database');
        var userId = '{user_id}';
        var sessionToken = '{session_token}';
        db.users.insertOne({{
          user_id: userId,
          email: 'test.user.{timestamp}@example.com',
          name: 'Test Practitioner',
          picture: '',
          role: 'medical_practitioner',
          created_at: new Date().toISOString()
        }});
        db.user_sessions.insertOne({{
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
          created_at: new Date().toISOString()
        }});
        print('Session created successfully');
        """
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                self.session_token = session_token
                self.user_id = user_id
                print(f"✅ Test session created: {session_token[:20]}...")
                return True
            else:
                print(f"❌ Failed to create test session: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Error creating test session: {str(e)}")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test /auth/me without token (should return 401)
        response = self.make_request('GET', 'auth/me')
        if response and response.status_code == 401:
            self.log_result("GET /auth/me (unauthenticated)", True, "Returns 401 as expected")
        else:
            self.log_result("GET /auth/me (unauthenticated)", False, 
                          f"Expected 401, got {response.status_code if response else 'No response'}")
        
        # Test /auth/me with token (should return user data)
        if self.session_token:
            response = self.make_request('GET', 'auth/me')
            if response and response.status_code == 200:
                user_data = response.json()
                if 'user_id' in user_data and 'email' in user_data:
                    self.log_result("GET /auth/me (authenticated)", True, "Returns user data")
                else:
                    self.log_result("GET /auth/me (authenticated)", False, "Missing user fields")
            else:
                self.log_result("GET /auth/me (authenticated)", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_user_endpoints(self):
        """Test user management endpoints"""
        print("\n👤 Testing User Endpoints...")
        
        # Test role update
        response = self.make_request('PUT', 'users/role', {'role': 'family_carer'})
        if response and response.status_code == 200:
            user_data = response.json()
            if user_data.get('role') == 'family_carer':
                self.log_result("PUT /users/role", True, "Role updated successfully")
            else:
                self.log_result("PUT /users/role", False, "Role not updated in response")
        else:
            self.log_result("PUT /users/role", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_patient_endpoints(self):
        """Test patient CRUD endpoints"""
        print("\n🏥 Testing Patient Endpoints...")
        
        # Test list patients (empty initially)
        response = self.make_request('GET', 'patients')
        if response and response.status_code == 200:
            patients = response.json()
            self.log_result("GET /patients", True, f"Returns {len(patients)} patients")
        else:
            self.log_result("GET /patients", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test create patient
        patient_data = {
            "name": "Test Patient",
            "dob": "1950-01-01",
            "gender": "Female",
            "emergency_contact": "Test Contact - 0400 000 000",
            "gp_details": "Dr Test - Test Clinic",
            "allergies": ["Penicillin"],
            "medical_history": "Test medical history"
        }
        
        response = self.make_request('POST', 'patients', patient_data)
        if response and response.status_code == 200:
            patient = response.json()
            if 'patient_id' in patient and patient['name'] == 'Test Patient':
                self.patient_id = patient['patient_id']
                self.log_result("POST /patients", True, f"Patient created: {self.patient_id}")
            else:
                self.log_result("POST /patients", False, "Invalid patient response")
        else:
            self.log_result("POST /patients", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test get specific patient
        if hasattr(self, 'patient_id'):
            response = self.make_request('GET', f'patients/{self.patient_id}')
            if response and response.status_code == 200:
                patient_details = response.json()
                if 'patient' in patient_details:
                    self.log_result("GET /patients/{id}", True, "Patient details retrieved")
                else:
                    self.log_result("GET /patients/{id}", False, "Missing patient data")
            else:
                self.log_result("GET /patients/{id}", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_upload_endpoints(self):
        """Test file upload endpoints"""
        print("\n📁 Testing Upload Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Upload tests", False, "No patient_id available")
            return
        
        # Create a simple test image (base64 encoded)
        test_image_data = base64.b64decode(
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A"
        )
        
        # Test file upload
        files = {'files': ('test_image.jpg', test_image_data, 'image/jpeg')}
        response = self.make_request('POST', f'upload/{self.patient_id}', files=files)
        
        if response and response.status_code == 200:
            upload_result = response.json()
            if 'documents' in upload_result and len(upload_result['documents']) > 0:
                self.document_id = upload_result['documents'][0].get('document_id')
                self.log_result("POST /upload/{patient_id}", True, f"File uploaded: {self.document_id}")
            else:
                self.log_result("POST /upload/{patient_id}", False, "No documents in response")
        else:
            self.log_result("POST /upload/{patient_id}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_processing_endpoints(self):
        """Test document processing endpoints"""
        print("\n⚙️ Testing Processing Endpoints...")
        
        if not hasattr(self, 'document_id'):
            self.log_result("Processing tests", False, "No document_id available")
            return
        
        # Test document processing
        response = self.make_request('POST', f'process/{self.document_id}')
        
        if response and response.status_code == 200:
            process_result = response.json()
            if 'summary' in process_result and 'risk_result' in process_result:
                self.result_id = process_result['risk_result'].get('result_id')
                self.log_result("POST /process/{document_id}", True, "Document processed successfully")
            else:
                self.log_result("POST /process/{document_id}", False, "Missing processing results")
        else:
            self.log_result("POST /process/{document_id}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_risk_results_endpoints(self):
        """Test risk results endpoints"""
        print("\n📊 Testing Risk Results Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Risk results tests", False, "No patient_id available")
            return
        
        # Test get risk results
        response = self.make_request('GET', f'risk-results/{self.patient_id}')
        if response and response.status_code == 200:
            results = response.json()
            self.log_result("GET /risk-results/{patient_id}", True, f"Returns {len(results)} results")
        else:
            self.log_result("GET /risk-results/{patient_id}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test get latest risk result
        response = self.make_request('GET', f'risk-results/{self.patient_id}/latest')
        if response and response.status_code == 200:
            latest_result = response.json()
            if 'risk_result' in latest_result or 'message' in latest_result:
                self.log_result("GET /risk-results/{patient_id}/latest", True, "Latest result retrieved")
            else:
                self.log_result("GET /risk-results/{patient_id}/latest", False, "Invalid response format")
        else:
            self.log_result("GET /risk-results/{patient_id}/latest", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_chat_endpoints(self):
        """Test chat/Q&A endpoints"""
        print("\n💬 Testing Chat Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Chat tests", False, "No patient_id available")
            return
        
        # Test get chat messages
        response = self.make_request('GET', f'chat/{self.patient_id}/messages')
        if response and response.status_code == 200:
            messages = response.json()
            self.log_result("GET /chat/{patient_id}/messages", True, f"Returns {len(messages)} messages")
        else:
            self.log_result("GET /chat/{patient_id}/messages", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test send chat message
        message_data = {"message": "What is the risk level for this patient?"}
        response = self.make_request('POST', f'chat/{self.patient_id}/messages', message_data)
        
        if response and response.status_code == 200:
            chat_result = response.json()
            if 'user_message' in chat_result and 'ai_message' in chat_result:
                self.log_result("POST /chat/{patient_id}/messages", True, "Chat message sent and AI responded")
            else:
                self.log_result("POST /chat/{patient_id}/messages", False, "Invalid chat response")
        else:
            self.log_result("POST /chat/{patient_id}/messages", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_alerts_endpoints(self):
        """Test alerts endpoints"""
        print("\n🚨 Testing Alerts Endpoints...")
        
        # Test get alerts
        response = self.make_request('GET', 'alerts')
        if response and response.status_code == 200:
            alerts = response.json()
            self.log_result("GET /alerts", True, f"Returns {len(alerts)} alerts")
        else:
            self.log_result("GET /alerts", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n📈 Testing Dashboard Endpoints...")
        
        # Test dashboard stats
        response = self.make_request('GET', 'dashboard/stats')
        if response and response.status_code == 200:
            stats = response.json()
            required_fields = ['total_patients', 'total_documents', 'high_risk', 'medium_risk', 'low_risk']
            if all(field in stats for field in required_fields):
                self.log_result("GET /dashboard/stats", True, "Dashboard stats retrieved")
            else:
                self.log_result("GET /dashboard/stats", False, "Missing required stats fields")
        else:
            self.log_result("GET /dashboard/stats", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_seed_endpoint(self):
        """Test seed data endpoint"""
        print("\n🌱 Testing Seed Endpoint...")
        
        # Test seed data creation
        response = self.make_request('POST', 'seed')
        if response and response.status_code == 200:
            seed_result = response.json()
            if 'patients' in seed_result:
                self.log_result("POST /seed", True, f"Seed data created: {len(seed_result['patients'])} patients")
            else:
                self.log_result("POST /seed", False, "Invalid seed response")
        else:
            self.log_result("POST /seed", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_pdf_report_endpoints(self):
        """Test PDF report generation endpoints"""
        print("\n📄 Testing PDF Report Endpoints...")
        
        if not hasattr(self, 'result_id'):
            self.log_result("PDF report tests", False, "No result_id available")
            return
        
        # Test PDF report generation
        response = self.make_request('GET', f'reports/{self.result_id}/pdf')
        if response and response.status_code == 200:
            # Check if response is PDF content
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                self.log_result("GET /reports/{result_id}/pdf", True, f"PDF generated ({len(response.content)} bytes)")
            else:
                self.log_result("GET /reports/{result_id}/pdf", False, f"Wrong content type: {content_type}")
        else:
            self.log_result("GET /reports/{result_id}/pdf", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_admin_scoring_config_endpoints(self):
        """Test admin scoring configuration endpoints"""
        print("\n⚙️ Testing Admin Scoring Config Endpoints...")
        
        # First ensure user has medical_practitioner role for admin access
        role_response = self.make_request('PUT', 'users/role', {'role': 'medical_practitioner'})
        if not (role_response and role_response.status_code == 200):
            self.log_result("Admin tests setup", False, "Could not set medical_practitioner role")
            return
        
        # Test get scoring config
        response = self.make_request('GET', 'admin/scoring-config')
        if response and response.status_code == 200:
            config = response.json()
            if 'medications' in config and 'thresholds' in config:
                self.log_result("GET /admin/scoring-config", True, "Scoring config retrieved")
            else:
                self.log_result("GET /admin/scoring-config", False, "Missing config fields")
        elif response and response.status_code == 403:
            self.log_result("GET /admin/scoring-config", False, "Access denied - role issue")
        else:
            self.log_result("GET /admin/scoring-config", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test update thresholds
        threshold_data = {
            "low": [0, 2],
            "medium": [3, 5], 
            "high": [6, 999]
        }
        response = self.make_request('PUT', 'admin/scoring-config/thresholds', threshold_data)
        if response and response.status_code == 200:
            result = response.json()
            if 'message' in result:
                self.log_result("PUT /admin/scoring-config/thresholds", True, "Thresholds updated")
            else:
                self.log_result("PUT /admin/scoring-config/thresholds", False, "Invalid response")
        elif response and response.status_code == 403:
            self.log_result("PUT /admin/scoring-config/thresholds", False, "Access denied - role issue")
        else:
            self.log_result("PUT /admin/scoring-config/thresholds", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test add medication
        med_data = {"name": "test_medication", "score": 2}
        response = self.make_request('POST', 'admin/scoring-config/medications', med_data)
        if response and response.status_code == 200:
            result = response.json()
            if 'message' in result:
                self.log_result("POST /admin/scoring-config/medications", True, "Medication added")
            else:
                self.log_result("POST /admin/scoring-config/medications", False, "Invalid response")
        elif response and response.status_code == 403:
            self.log_result("POST /admin/scoring-config/medications", False, "Access denied - role issue")
        else:
            self.log_result("POST /admin/scoring-config/medications", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test remove medication
        response = self.make_request('DELETE', 'admin/scoring-config/medications/test_medication')
        if response and response.status_code == 200:
            result = response.json()
            if 'message' in result:
                self.log_result("DELETE /admin/scoring-config/medications/{name}", True, "Medication removed")
            else:
                self.log_result("DELETE /admin/scoring-config/medications/{name}", False, "Invalid response")
        elif response and response.status_code == 403:
            self.log_result("DELETE /admin/scoring-config/medications/{name}", False, "Access denied - role issue")
        else:
            self.log_result("DELETE /admin/scoring-config/medications/{name}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_patient_update_endpoints(self):
        """Test patient profile editing endpoints"""
        print("\n👤 Testing Patient Update Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Patient update tests", False, "No patient_id available")
            return
        
        # Test patient update
        update_data = {
            "name": "Updated Test Patient",
            "emergency_contact": "Updated Contact - 0400 111 111",
            "medical_history": "Updated medical history"
        }
        response = self.make_request('PUT', f'patients/{self.patient_id}', update_data)
        if response and response.status_code == 200:
            patient = response.json()
            if patient.get('name') == 'Updated Test Patient':
                self.log_result("PUT /patients/{patient_id}", True, "Patient updated successfully")
            else:
                self.log_result("PUT /patients/{patient_id}", False, "Patient not updated properly")
        else:
            self.log_result("PUT /patients/{patient_id}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_audit_log_endpoints(self):
        """Test audit log endpoints"""
        print("\n📋 Testing Audit Log Endpoints...")
        
        # Test get audit logs
        response = self.make_request('GET', 'audit-logs')
        if response and response.status_code == 200:
            audit_data = response.json()
            if 'logs' in audit_data and 'total' in audit_data:
                self.log_result("GET /audit-logs", True, f"Audit logs retrieved ({audit_data['total']} total)")
            else:
                self.log_result("GET /audit-logs", False, "Invalid audit log response")
        else:
            self.log_result("GET /audit-logs", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_notification_settings_endpoints(self):
        """Test notification settings endpoints"""
        print("\n🔔 Testing Notification Settings Endpoints...")
        
        # Test get notification settings
        response = self.make_request('GET', 'settings/notifications')
        if response and response.status_code == 200:
            settings = response.json()
            if 'user_id' in settings:
                self.log_result("GET /settings/notifications", True, "Notification settings retrieved")
            else:
                self.log_result("GET /settings/notifications", False, "Invalid settings response")
        else:
            self.log_result("GET /settings/notifications", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test update notification settings
        settings_data = {
            "email_high_risk": True,
            "email_medium_risk": False,
            "in_app_high_risk": True,
            "in_app_medium_risk": True,
            "in_app_low_risk": False
        }
        response = self.make_request('PUT', 'settings/notifications', settings_data)
        if response and response.status_code == 200:
            result = response.json()
            if 'message' in result:
                self.log_result("PUT /settings/notifications", True, "Notification settings updated")
            else:
                self.log_result("PUT /settings/notifications", False, "Invalid update response")
        else:
            self.log_result("PUT /settings/notifications", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_multiple_engines_endpoints(self):
        """Test multiple scoring engines endpoints - ITERATION 3"""
        print("\n🔧 Testing Multiple Scoring Engines Endpoints...")
        
        # First ensure user has medical_practitioner role for admin access
        role_response = self.make_request('PUT', 'users/role', {'role': 'medical_practitioner'})
        if not (role_response and role_response.status_code == 200):
            self.log_result("Multiple engines setup", False, "Could not set medical_practitioner role")
            return
        
        # Test GET /admin/engines
        response = self.make_request('GET', 'admin/engines')
        if response and response.status_code == 200:
            engines_data = response.json()
            engines = engines_data.get('engines', [])
            active_engine = engines_data.get('active_engine')
            
            # Check for required engines
            engine_names = [e['name'] for e in engines]
            required_engines = ['ACB', 'DBI', 'SEDLOAD']
            
            if all(engine in engine_names for engine in required_engines):
                self.log_result("GET /admin/engines", True, f"Found all 3 engines: {engine_names}, active: {active_engine}")
                
                # Test each engine has medication count
                for engine in engines:
                    if 'medication_count' in engine and engine['medication_count'] > 0:
                        self.log_result(f"Engine {engine['name']} medication count", True, f"{engine['medication_count']} medications")
                    else:
                        self.log_result(f"Engine {engine['name']} medication count", False, "No medication count")
            else:
                missing = [e for e in required_engines if e not in engine_names]
                self.log_result("GET /admin/engines", False, f"Missing engines: {missing}")
        else:
            self.log_result("GET /admin/engines", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test switching engines
        for engine in ['DBI', 'SEDLOAD', 'ACB']:
            response = self.make_request('PUT', 'admin/engines/active', {'engine': engine})
            if response and response.status_code == 200:
                result = response.json()
                if result.get('active_engine') == engine:
                    self.log_result(f"PUT /admin/engines/active ({engine})", True, f"Switched to {engine}")
                else:
                    self.log_result(f"PUT /admin/engines/active ({engine})", False, "Engine not switched")
            else:
                self.log_result(f"PUT /admin/engines/active ({engine})", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")
            
            # Test engine-specific config
            response = self.make_request('GET', f'admin/scoring-config?engine={engine}')
            if response and response.status_code == 200:
                config = response.json()
                if 'medications' in config and 'full_name' in config:
                    med_count = len(config['medications'])
                    self.log_result(f"GET /admin/scoring-config?engine={engine}", True, 
                                  f"{engine} config: {med_count} medications, {config['full_name']}")
                else:
                    self.log_result(f"GET /admin/scoring-config?engine={engine}", False, "Missing config fields")
            else:
                self.log_result(f"GET /admin/scoring-config?engine={engine}", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_email_endpoints(self):
        """Test email notification endpoints - ITERATION 3"""
        print("\n📧 Testing Email Endpoints...")
        
        # Test GET /email/status
        response = self.make_request('GET', 'email/status')
        if response and response.status_code == 200:
            status = response.json()
            configured = status.get('configured', True)  # Should be False since RESEND_API_KEY is empty
            if configured == False:
                self.log_result("GET /email/status", True, "Email not configured (expected)")
            else:
                self.log_result("GET /email/status", False, f"Expected configured=false, got {configured}")
        else:
            self.log_result("GET /email/status", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Test POST /email/test
        response = self.make_request('POST', 'email/test', {})
        if response and response.status_code == 200:
            test_result = response.json()
            status = test_result.get('status')
            if status == 'skipped':
                self.log_result("POST /email/test", True, "Email test skipped (graceful fallback)")
            else:
                self.log_result("POST /email/test", False, f"Expected status=skipped, got {status}")
        else:
            self.log_result("POST /email/test", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_report_history_endpoints(self):
        """Test report history and comparison endpoints - ITERATION 4"""
        print("\n📈 Testing Report History Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Report history tests", False, "No patient_id available")
            return
        
        # Test GET /risk-results/{patient_id}/history
        response = self.make_request('GET', f'risk-results/{self.patient_id}/history')
        if response and response.status_code == 200:
            history = response.json()
            if isinstance(history, list):
                self.log_result("GET /risk-results/{patient_id}/history", True, f"Returns {len(history)} historical results")
                
                # If we have at least 2 results, test comparison
                if len(history) >= 2:
                    result_a = history[0]['result_id']
                    result_b = history[1]['result_id']
                    
                    # Test GET /risk-results/{patient_id}/compare
                    response = self.make_request('GET', f'risk-results/{self.patient_id}/compare?result_a={result_a}&result_b={result_b}')
                    if response and response.status_code == 200:
                        comparison = response.json()
                        required_fields = ['result_a', 'result_b', 'score_change', 'level_change', 'medication_diff']
                        if all(field in comparison for field in required_fields):
                            self.log_result("GET /risk-results/{patient_id}/compare", True, "Comparison data returned")
                        else:
                            missing = [f for f in required_fields if f not in comparison]
                            self.log_result("GET /risk-results/{patient_id}/compare", False, f"Missing fields: {missing}")
                    else:
                        self.log_result("GET /risk-results/{patient_id}/compare", False, 
                                      f"Expected 200, got {response.status_code if response else 'No response'}")
                else:
                    self.log_result("GET /risk-results/{patient_id}/compare", False, "Need at least 2 results for comparison")
            else:
                self.log_result("GET /risk-results/{patient_id}/history", False, "Response is not a list")
        else:
            self.log_result("GET /risk-results/{patient_id}/history", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")

    def test_csv_export_endpoints(self):
        """Test CSV export endpoints - ITERATION 4"""
        print("\n📊 Testing CSV Export Endpoints...")
        
        # Test GET /export/patients
        response = self.make_request('GET', 'export/patients')
        if response and response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'text/csv' in content_type or 'application/csv' in content_type:
                self.log_result("GET /export/patients", True, f"CSV exported ({len(response.content)} bytes)")
            else:
                self.log_result("GET /export/patients", False, f"Wrong content type: {content_type}")
        else:
            self.log_result("GET /export/patients", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        if hasattr(self, 'patient_id'):
            # Test GET /export/risk-results/{patient_id}
            response = self.make_request('GET', f'export/risk-results/{self.patient_id}')
            if response and response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'text/csv' in content_type or 'application/csv' in content_type:
                    self.log_result("GET /export/risk-results/{patient_id}", True, f"Risk results CSV exported ({len(response.content)} bytes)")
                else:
                    self.log_result("GET /export/risk-results/{patient_id}", False, f"Wrong content type: {content_type}")
            else:
                self.log_result("GET /export/risk-results/{patient_id}", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")
            
            # Test GET /export/medications/{patient_id}
            response = self.make_request('GET', f'export/medications/{self.patient_id}')
            if response and response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'text/csv' in content_type or 'application/csv' in content_type:
                    self.log_result("GET /export/medications/{patient_id}", True, f"Medications CSV exported ({len(response.content)} bytes)")
                else:
                    self.log_result("GET /export/medications/{patient_id}", False, f"Wrong content type: {content_type}")
            else:
                self.log_result("GET /export/medications/{patient_id}", False, 
                              f"Expected 200, got {response.status_code if response else 'No response'}")
        else:
            self.log_result("CSV export patient tests", False, "No patient_id available")

    def test_care_relationships_endpoints(self):
        """Test care relationships endpoints - ITERATION 4"""
        print("\n👥 Testing Care Relationships Endpoints...")
        
        if not hasattr(self, 'patient_id'):
            self.log_result("Care relationships tests", False, "No patient_id available")
            return
        
        # Test GET /care-relationships/{patient_id}
        response = self.make_request('GET', f'care-relationships/{self.patient_id}')
        if response and response.status_code == 200:
            relationships = response.json()
            if isinstance(relationships, list):
                self.log_result("GET /care-relationships/{patient_id}", True, f"Returns {len(relationships)} relationships")
            else:
                self.log_result("GET /care-relationships/{patient_id}", False, "Response is not a list")
        else:
            self.log_result("GET /care-relationships/{patient_id}", False, 
                          f"Expected 200, got {response.status_code if response else 'No response'}")
        
        # Create a test relationship
        relationship_data = {
            "patient_id": self.patient_id,
            "user_email": f"test.carer.{int(time.time())}@example.com",
            "relationship_type": "carer"
        }
        
        # First create a test user for the relationship
        timestamp = int(time.time())
        carer_user_id = f"test-carer-{timestamp}"
        carer_email = relationship_data["user_email"]
        
        mongo_script = f"""
        use('test_database');
        db.users.insertOne({{
          user_id: '{carer_user_id}',
          email: '{carer_email}',
          name: 'Test Carer',
          picture: '',
          role: 'family_carer',
          created_at: new Date().toISOString()
        }});
        """
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                # Test POST /care-relationships
                response = self.make_request('POST', 'care-relationships', relationship_data)
                if response and response.status_code == 200:
                    relationship = response.json()
                    if 'relationship_id' in relationship:
                        self.relationship_id = relationship['relationship_id']
                        self.log_result("POST /care-relationships", True, f"Relationship created: {self.relationship_id}")
                        
                        # Test DELETE /care-relationships/{id}
                        response = self.make_request('DELETE', f'care-relationships/{self.relationship_id}')
                        if response and response.status_code == 200:
                            result = response.json()
                            if 'message' in result:
                                self.log_result("DELETE /care-relationships/{id}", True, "Relationship deleted")
                            else:
                                self.log_result("DELETE /care-relationships/{id}", False, "Invalid delete response")
                        else:
                            self.log_result("DELETE /care-relationships/{id}", False, 
                                          f"Expected 200, got {response.status_code if response else 'No response'}")
                    else:
                        self.log_result("POST /care-relationships", False, "No relationship_id in response")
                else:
                    self.log_result("POST /care-relationships", False, 
                                  f"Expected 200, got {response.status_code if response else 'No response'}")
            else:
                self.log_result("Care relationships setup", False, "Could not create test carer user")
        except Exception as e:
            self.log_result("Care relationships setup", False, f"Error creating test carer: {str(e)}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🧪 Starting SafeMedAI Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Create test session first
        if not self.create_test_session():
            print("❌ Cannot proceed without test session")
            return False
        
        # Run all test suites
        self.test_auth_endpoints()
        self.test_patient_endpoints()
        self.test_upload_endpoints()
        self.test_processing_endpoints()
        self.test_risk_results_endpoints()
        self.test_chat_endpoints()
        self.test_alerts_endpoints()
        self.test_dashboard_endpoints()
        self.test_seed_endpoint()
        
        # ITERATION 2 FEATURES
        self.test_pdf_report_endpoints()
        self.test_admin_scoring_config_endpoints()  # Test admin features before changing role
        self.test_patient_update_endpoints()
        self.test_audit_log_endpoints()
        self.test_notification_settings_endpoints()
        
        # ITERATION 3 FEATURES
        self.test_multiple_engines_endpoints()
        self.test_email_endpoints()
        
        # ITERATION 4 FEATURES
        self.test_report_history_endpoints()
        self.test_csv_export_endpoints()
        self.test_care_relationships_endpoints()
        
        # Test user role change last
        self.test_user_endpoints()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SafeMedAITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())