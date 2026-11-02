import os
import sys
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure sdk package is importable
sdk_path = Path(__file__).resolve().parent.parent.parent / "sdk"
if str(sdk_path) not in sys.path:
    sys.path.insert(0, str(sdk_path))

from app.db import init_db, DB_FILE
import app.db as app_db
from app.seed import seed_database
from app.main import app
from datetime import datetime

# Legacy tests assert against the demo world that production seed.py no
# longer ships ("WARDEN runs clean"). Recreate that world here, for tests
# only: five RBAC roles, the governed support agent, and the auxiliary
# passports named in the policy rule examples. Agente registrations append
# AGENT_REGISTERED entries so the initial ledger chain has >= 4 records.
DEMO_USERS = [
    ("approver", "approver@warden.enterprise.local", "approver"),
    ("risklead", "risklead@warden.enterprise.local", "risk_lead"),
    ("exec", "exec@warden.enterprise.local", "executive"),
    ("auditor", "auditor@warden.enterprise.local", "auditor"),
]

DEMO_AGENTS = [
    {
        "agent_id": "support_agent_01",
        "name": "Customer Support Agent",
        "owner": "admin",
        "purpose": "Handle support refunds and record updates for customers",
        "allowed_actions": ["issue_refund", "update_record"],
        "allowed_data_classes": ["public", "internal", "confidential"],
        "max_amount": 100000.0,
        "api_key": "wrd_demo_support_key_123",
    },
    {
        "agent_id": "data_sync_agent_02",
        "name": "Data Sync Agent",
        "owner": "approver",
        "purpose": "Sync internal records between systems",
        "allowed_actions": ["sync_records"],
        "allowed_data_classes": ["public", "internal"],
        "max_amount": 0.0,
        "api_key": None,
    },
    {
        "agent_id": "finance_bot_03",
        "name": "Finance Bot",
        "owner": "admin",
        "purpose": "Process vendor payouts within budget",
        "allowed_actions": ["vendor_payout"],
        "allowed_data_classes": ["internal", "confidential"],
        "max_amount": 25000.0,
        "api_key": None,
    },
]


def seed_demo_world():
    """Register the demo identities the legacy test suite assumes."""
    from datetime import datetime, timezone
    from app.db import get_connection
    from app.services import agent_service
    from app.services.auth_service import hash_password

    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    for username, email, role in DEMO_USERS:
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (username, email, hashed_password, full_name, role, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (username, email, hash_password("demo123"), username.title(), role, now))
    conn.commit()
    conn.close()

    for spec in DEMO_AGENTS:
        if not agent_service.get_agent_by_id(spec["agent_id"]):
            agent_service.create_agent(
                agent_id=spec["agent_id"],
                name=spec["name"],
                owner=spec["owner"],
                purpose=spec["purpose"],
                allowed_actions=spec["allowed_actions"],
                allowed_data_classes=spec["allowed_data_classes"],
                max_amount=spec["max_amount"],
                status="active",
                custom_api_key=spec["api_key"],
            )

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path):
    """Create a clean isolated SQLite database for each test."""
    test_db_file = tmp_path / "test_warden.db"
    test_db_path = str(test_db_file)
    
    # Redirect DB connection to temporary file
    old_sqlite_path = os.environ.get("SQLITE_PATH")
    os.environ["SQLITE_PATH"] = test_db_path
    app_db.DB_FILE = test_db_path

    # Initialize and seed fresh tables
    init_db()
    seed_database()
    seed_demo_world()

    yield test_db_path

    # Restore environment
    if old_sqlite_path is not None:
        os.environ["SQLITE_PATH"] = old_sqlite_path
        app_db.DB_FILE = old_sqlite_path
    else:
        os.environ.pop("SQLITE_PATH", None)
        app_db.DB_FILE = "warden.db"

@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def admin_headers(client):
    """Auth headers for admin user."""
    res = client.post("/auth/login", json={"username": "admin", "password": "demo123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auditor_headers(client):
    """Auth headers for auditor user."""
    res = client.post("/auth/login", json={"username": "auditor", "password": "demo123"})
    assert res.status_code == 200, f"Auditor login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def approver_headers(client):
    """Auth headers for approver user."""
    res = client.post("/auth/login", json={"username": "approver", "password": "demo123"})
    assert res.status_code == 200, f"Approver login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
