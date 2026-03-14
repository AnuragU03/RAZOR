"""
EngineOps API Tests - Testing partner status, MCP endpoint, demo, projects, pipeline runs, and audit trail
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health and root endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print("✓ Health endpoint working")
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        print("✓ Root endpoint working")


class TestPartnerStatus:
    """Partner integration status endpoint tests"""
    
    def test_partner_status_returns_all_5_partners(self):
        """Test GET /api/partner-status returns status for all 5 partners"""
        response = requests.get(f"{BASE_URL}/api/partner-status")
        assert response.status_code == 200
        data = response.json()
        
        # Check all 5 partners are present
        expected_partners = ["unsiloed", "safedep", "s2", "gearsec", "concierge"]
        for partner in expected_partners:
            assert partner in data, f"Partner '{partner}' missing from response"
            assert "configured" in data[partner], f"Partner '{partner}' missing 'configured' field"
            assert "name" in data[partner], f"Partner '{partner}' missing 'name' field"
            assert "role" in data[partner], f"Partner '{partner}' missing 'role' field"
        
        print(f"✓ Partner status returned all 5 partners: {list(data.keys())}")
        
    def test_partner_status_correct_names(self):
        """Test partner names and roles are correct"""
        response = requests.get(f"{BASE_URL}/api/partner-status")
        data = response.json()
        
        expected_info = {
            "unsiloed": {"name": "Unsiloed", "role": "Document Parser"},
            "safedep": {"name": "Safedep", "role": "Security Scanner"},
            "s2": {"name": "S2.dev", "role": "Audit Trail"},
            "gearsec": {"name": "Gearsec", "role": "Policy Gate"},
            "concierge": {"name": "Concierge", "role": "Notifications"},
        }
        
        for key, info in expected_info.items():
            assert data[key]["name"] == info["name"], f"Partner '{key}' has wrong name"
            assert data[key]["role"] == info["role"], f"Partner '{key}' has wrong role"
        
        print("✓ Partner names and roles are correct")


class TestMCPEndpoint:
    """MCP server endpoint tests"""
    
    def test_mcp_endpoint_returns_server_info(self):
        """Test POST /api/mcp returns MCP server info with tools list"""
        response = requests.post(f"{BASE_URL}/api/mcp", json={})
        assert response.status_code == 200
        data = response.json()
        
        # Check server info
        assert data["name"] == "engineops"
        assert data["version"] == "1.0.0"
        assert "description" in data
        
        # Check tools list
        assert "tools" in data
        assert isinstance(data["tools"], list)
        assert len(data["tools"]) >= 3
        
        tool_names = [t["name"] for t in data["tools"]]
        assert "run_docs_pipeline" in tool_names
        assert "run_bugfix_pipeline" in tool_names
        assert "get_project_status" in tool_names
        
        print(f"✓ MCP endpoint returned server info with {len(data['tools'])} tools")


class TestProjectsEndpoints:
    """Project listing and demo project tests"""
    
    def test_list_projects(self):
        """Test GET /api/projects returns project list including demo project"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least 1 project (demo project)"
        
        # Find demo project
        demo_project = None
        for p in data:
            if p.get("id") == "54b01f81-6ff5-4d9e-a9e8-a7d8c0e1fc5b":
                demo_project = p
                break
        
        assert demo_project is not None, "Demo project not found"
        assert demo_project["repo_url"] == "https://github.com/pallets/flask"
        assert demo_project["repo_owner"] == "pallets"
        assert demo_project["repo_name"] == "flask"
        
        print(f"✓ Projects list returned {len(data)} projects including demo project")
    
    def test_get_specific_project(self):
        """Test GET /api/projects/{id} returns project details"""
        project_id = "54b01f81-6ff5-4d9e-a9e8-a7d8c0e1fc5b"
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == project_id
        assert data["repo_url"] == "https://github.com/pallets/flask"
        assert "status" in data
        assert "created_at" in data
        
        print(f"✓ Project {project_id} details retrieved successfully")


class TestPipelineRuns:
    """Pipeline runs endpoint tests - 8 steps each"""
    
    def test_list_pipeline_runs(self):
        """Test GET /api/projects/{id}/pipeline-runs returns pipeline runs"""
        project_id = "54b01f81-6ff5-4d9e-a9e8-a7d8c0e1fc5b"
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/pipeline-runs")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least 1 pipeline run"
        
        print(f"✓ Pipeline runs returned {len(data)} runs for project")
    
    def test_bugfix_pipeline_has_8_steps(self):
        """Test bugfix pipeline run has 8 steps with correct step names"""
        run_id = "e5f22790-9f5b-4237-a82d-06c0b5ea0bb1"
        response = requests.get(f"{BASE_URL}/api/pipeline-runs/{run_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["pipeline_type"] == "bugfix"
        assert data["status"] == "completed"
        assert len(data["steps"]) == 8, f"Expected 8 steps, got {len(data['steps'])}"
        
        # Verify step names
        expected_steps = [
            "Unsiloed Parser",
            "Log Parser", 
            "Patch Generator",
            "Sandbox Tester",
            "Selector",
            "Gearsec MCP",
            "Merger",
            "Concierge"
        ]
        actual_steps = [s["name"] for s in data["steps"]]
        assert actual_steps == expected_steps, f"Step names mismatch: {actual_steps}"
        
        print(f"✓ Bugfix pipeline has 8 steps: {actual_steps}")
    
    def test_bugfix_pipeline_result_has_partner_badges(self):
        """Test bugfix pipeline result contains partner badges"""
        run_id = "e5f22790-9f5b-4237-a82d-06c0b5ea0bb1"
        response = requests.get(f"{BASE_URL}/api/pipeline-runs/{run_id}")
        data = response.json()
        
        assert "result" in data
        assert "partner_badges" in data["result"]
        badges = data["result"]["partner_badges"]
        
        # Check expected badges for bugfix
        assert "unsiloed" in badges, "Unsiloed badge missing"
        assert "gearsec" in badges, "Gearsec badge missing"
        assert "s2" in badges, "S2 badge missing"
        assert "concierge" in badges, "Concierge badge missing"
        
        print(f"✓ Bugfix pipeline result has partner badges: {list(badges.keys())}")
    
    def test_bugfix_gearsec_result(self):
        """Test bugfix pipeline has Gearsec policy check result with status"""
        project_id = "54b01f81-6ff5-4d9e-a9e8-a7d8c0e1fc5b"
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/bugfixes/latest")
        assert response.status_code == 200
        data = response.json()
        
        assert "gearsec_result" in data
        gearsec = data["gearsec_result"]
        assert "status" in gearsec, "Gearsec result missing 'status'"
        assert gearsec["status"] in ["pass", "fail"], f"Unexpected gearsec status: {gearsec['status']}"
        assert "engine" in gearsec
        
        print(f"✓ Gearsec policy check result: {gearsec['status'].upper()}")


class TestS2AuditTrail:
    """S2.dev audit trail endpoint tests"""
    
    def test_audit_trail_returns_records(self):
        """Test GET /api/pipeline-runs/{run_id}/audit-trail returns S2.dev audit records"""
        run_id = "e5f22790-9f5b-4237-a82d-06c0b5ea0bb1"
        response = requests.get(f"{BASE_URL}/api/pipeline-runs/{run_id}/audit-trail")
        assert response.status_code == 200
        data = response.json()
        
        assert "available" in data
        assert "run_id" in data
        assert data["run_id"] == run_id
        
        if data["available"]:
            assert "total_steps" in data
            assert "records" in data
            assert isinstance(data["records"], list)
            
            # Should have records for running + completed status of each step
            assert data["total_steps"] >= 8, f"Expected at least 8 audit records, got {data['total_steps']}"
            
            print(f"✓ S2.dev audit trail returned {data['total_steps']} records for run {run_id}")
        else:
            print("⚠ S2.dev not configured - audit trail not available")


class TestDemoEndpoint:
    """One-click demo endpoint tests"""
    
    def test_demo_endpoint_accepts_post(self):
        """Test POST /api/demo endpoint exists and works"""
        # We just test that it returns a valid response (may re-trigger pipelines on existing demo)
        response = requests.post(f"{BASE_URL}/api/demo")
        assert response.status_code in [200, 409], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "project_id" in data
            assert "status" in data
            print(f"✓ Demo endpoint returned project_id: {data['project_id']}")
        else:
            print("✓ Demo endpoint exists (pipeline may already be running)")


class TestStatsEndpoint:
    """Dashboard stats endpoint tests"""
    
    def test_stats_endpoint(self):
        """Test GET /api/stats returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = ["total_projects", "total_pipeline_runs", "completed_runs", "success_rate"]
        for field in expected_fields:
            assert field in data, f"Stats missing '{field}'"
        
        print(f"✓ Stats: {data['total_projects']} projects, {data['total_pipeline_runs']} runs, {data['success_rate']}% success rate")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
