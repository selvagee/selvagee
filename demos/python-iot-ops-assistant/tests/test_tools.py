import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.tools import execute_tool, tool_definitions

def test_known_site():
    result = execute_tool("get_site_details", "DEMO001")
    assert result["data"]["online"] is True

def test_alarm_lookup():
    result = execute_tool("get_active_alarms", "DEMO002")
    assert result["data"][0]["severity"] == "high"

@pytest.mark.parametrize("tool,site", [
    ("delete_site", "DEMO001"), ("get_devices", "../etc/passwd"),
    ("get_devices", "UNKNOWN"), ("get_devices", "DEMO001;DROP")
])
def test_rejects_invalid_tool_calls(tool, site):
    with pytest.raises(ValueError):
        execute_tool(tool, site)

def test_tool_schema_is_read_only_and_bounded():
    assert len(tool_definitions()) == 3

def test_http_endpoints_without_ollama():
    client = TestClient(app)
    assert client.get("/healthz").status_code == 200
    assert client.get("/api/sites/DEMO001").json()["data"]["camera_count"] == 4
    assert client.post("/api/ask", json={"question": ""}).status_code == 422
