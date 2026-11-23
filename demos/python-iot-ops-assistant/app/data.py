"""Synthetic, non-customer demonstration records."""
SITES = {
    "DEMO001": {"site_id": "DEMO001", "name": "Warehouse Demo", "online": True, "camera_count": 4},
    "DEMO002": {"site_id": "DEMO002", "name": "Branch Demo", "online": False, "camera_count": 2},
}
DEVICES = {
    "DEMO001": [{"device_id": "TEMP01", "type": "temperature", "online": True, "value": 26.4}],
    "DEMO002": [{"device_id": "TEMP02", "type": "temperature", "online": False, "value": None}],
}
ALARMS = {
    "DEMO001": [{"alarm_id": "A-100", "severity": "low", "message": "Synthetic temperature threshold warning"}],
    "DEMO002": [{"alarm_id": "A-200", "severity": "high", "message": "Synthetic site offline"}],
}
