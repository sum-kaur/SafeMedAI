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
        self.test_user_endpoints()
        self.test_patient_endpoints()
        self.test_upload_endpoints()
        self.test_processing_endpoints()
        self.test_risk_results_endpoints()
        self.test_chat_endpoints()
        self.test_alerts_endpoints()
        self.test_dashboard_endpoints()
        self.test_seed_endpoint()
        
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