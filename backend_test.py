#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Optional

class EngineOpsAPITester:
    def __init__(self, base_url="https://ops-shipped.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None
        self.results = {}

    def run_test(self, name: str, method: str, endpoint: str, expected_status, data: Optional[dict] = None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Status Code: {response.status_code}")
            
            # Handle expected status as single value or list
            if isinstance(expected_status, list):
                success = response.status_code in expected_status
                expected_display = f"one of {expected_status}"
            else:
                success = response.status_code == expected_status
                expected_display = str(expected_status)
                
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - {name}")
                try:
                    response_data = response.json() if response.text else {}
                    self.results[name] = {"status": "passed", "response": response_data}
                    return success, response_data
                except:
                    self.results[name] = {"status": "passed", "response": response.text}
                    return success, response.text
            else:
                print(f"❌ FAILED - {name}")
                print(f"   Expected: {expected_display}, Got: {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}")
                self.results[name] = {"status": "failed", "expected": expected_display, "actual": response.status_code, "response": response.text}
                return False, {}

        except Exception as e:
            print(f"❌ ERROR - {name}: {str(e)}")
            self.results[name] = {"status": "error", "error": str(e)}
            return False, {}

    def test_health_endpoints(self):
        """Test health and basic endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("API Root", "GET", "/", 200)
        self.run_test("Health Check", "GET", "/health", 200)
        self.run_test("Dashboard Stats", "GET", "/stats", 200)

    def test_project_crud(self):
        """Test project CRUD operations"""
        print("\n" + "="*50)
        print("TESTING PROJECT CRUD OPERATIONS")
        print("="*50)
        
        # List projects (should work even if empty)
        success, projects = self.run_test("List Projects", "GET", "/projects", 200)
        if success:
            print(f"   Found {len(projects)} existing projects")
            
        # Test creating a project with public repo
        project_data = {
            "repo_url": "https://github.com/expressjs/express",
            "github_token": None  # Public repo
        }
        success, response = self.run_test("Create Project", "POST", "/projects", 200, project_data)
        
        if success and isinstance(response, dict) and 'id' in response:
            self.project_id = response['id']
            print(f"   Created project ID: {self.project_id}")
            
            # Test getting the specific project
            self.run_test("Get Project", "GET", f"/projects/{self.project_id}", 200)
            
            # Test project endpoints
            self.run_test("Get Project Pipeline Runs", "GET", f"/projects/{self.project_id}/pipeline-runs", 200)
            
        # Test invalid project ID
        self.run_test("Get Non-existent Project", "GET", "/projects/invalid-id", 404)

    def test_pipeline_endpoints(self):
        """Test pipeline related endpoints"""
        print("\n" + "="*50)
        print("TESTING PIPELINE ENDPOINTS")
        print("="*50)
        
        if not self.project_id:
            print("⚠️  No project ID available, skipping pipeline tests")
            return
            
        # Test docs pipeline trigger
        success, response = self.run_test("Trigger Docs Pipeline", "POST", f"/projects/{self.project_id}/run-docs", 200)
        
        # Test bugfix pipeline with sample CI log
        sample_ci_log = """
FAILED: test_app.py::test_login - AssertionError: Expected 200 but got 500
Traceback:
  File auth.py line 42 in login()
    user = db.find_user(email)
AttributeError: 'NoneType' object has no attribute 'find_user'
        """
        
        bugfix_data = {"ci_log": sample_ci_log.strip()}
        self.run_test("Trigger Bugfix Pipeline", "POST", f"/projects/{self.project_id}/run-bugfix", 200, bugfix_data)
        
        # Test GitHub CI runs endpoint
        self.run_test("Get CI Runs", "GET", f"/projects/{self.project_id}/ci-runs", 200)

    def test_results_endpoints(self):
        """Test results endpoints"""
        print("\n" + "="*50)
        print("TESTING RESULTS ENDPOINTS")
        print("="*50)
        
        if not self.project_id:
            print("⚠️  No project ID available, skipping results tests")
            return
            
        # These might return 404 if no results exist yet, which is expected
        self.run_test("Get Docs Result", "GET", f"/projects/{self.project_id}/docs", [200, 404])
        self.run_test("Get Bugfix Results", "GET", f"/projects/{self.project_id}/bugfixes", 200)
        self.run_test("Get Latest Bugfix", "GET", f"/projects/{self.project_id}/bugfixes/latest", [200, 404])

    def cleanup(self):
        """Clean up test project"""
        if self.project_id:
            print(f"\n🧹 Cleaning up test project {self.project_id}")
            self.run_test("Delete Test Project", "DELETE", f"/projects/{self.project_id}", 200)

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        # Show failed tests
        failed_tests = [name for name, result in self.results.items() if result["status"] != "passed"]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test_name in failed_tests:
                result = self.results[test_name]
                error_msg = result.get('error', f'Expected {result.get("expected")}, got {result.get("actual")}')
                print(f"   - {test_name}: {error_msg}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    print("🚀 Starting EngineOps API Tests...")
    print(f"📅 Test Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = EngineOpsAPITester()
    
    try:
        # Run all test suites
        tester.test_health_endpoints()
        tester.test_project_crud()  
        tester.test_pipeline_endpoints()
        tester.test_results_endpoints()
        
        # Clean up
        tester.cleanup()
        
        # Print summary and return appropriate exit code
        all_passed = tester.print_summary()
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())