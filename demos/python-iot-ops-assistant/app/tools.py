"""Allowlisted, read-only tools with strict site IDs and bounded results."""
import re
from .data import SITES, DEVICES, ALARMS

SITE_RE = re.compile(r"^DEMO[0-9]{3}$")
TOOLS = {
    "get_site_details": lambda site: SITES.get(site),
    "get_devices": lambda site: DEVICES.get(site, []),
    "get_active_alarms": lambda site: ALARMS.get(site, []),
}

def execute_tool(name: str, site_id: str):
    if name not in TOOLS:
        raise ValueError("Tool not allowed")
    if not SITE_RE.fullmatch(site_id):
        raise ValueError("Invalid synthetic site ID")
    if site_id not in SITES:
        raise ValueError("Site not found")
    return {"tool": name, "site_id": site_id, "data": TOOLS[name](site_id)}

def tool_definitions():
    return [{
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": {"site_id": {"type": "string", "description": "Synthetic site identifier like DEMO001"}},
                "required": ["site_id"],
                "additionalProperties": False
            }
        }
    } for name, description in [
        ("get_site_details", "Get a synthetic site's connectivity and camera count"),
        ("get_devices", "List synthetic IoT devices for a site"),
        ("get_active_alarms", "List synthetic active alarms for a site")
    ]]
