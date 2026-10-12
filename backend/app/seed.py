"""Seed database with the operator account and the genesis ledger entry.

Demo users/agents were removed: this WARDEN runs clean. The ShopAssist bot
registers its own passport (shopassist_bot) via the Agents API.
All operators use the admin account (it bypasses role checks).
"""
from datetime import datetime
from app.db import init_db, get_connection
from app.services.auth_service import hash_password
from app.services.agent_service import create_agent, get_agent_by_id
from app.services.ledger_service import append_ledger_entry, verify_ledger_chain

SEED_USERS = [
    {
        "username": "admin",
        "email": "admin@warden.enterprise.local",
        "password": "demo123",
        "full_name": "Chief Security Admin",
        "role": "admin"
    }
]

SEED_AGENTS = []

def seed_database():
    """Run seeding routine."""
    print("[WARDEN SEED] Initializing database schema...")
    init_db()

    conn = get_connection()
    cursor = conn.cursor()

    # Seed users
    print("[WARDEN SEED] Seeding RBAC users...")
    now = datetime.utcnow().isoformat() + "Z"
    for user_data in SEED_USERS:
        cursor.execute("SELECT id FROM users WHERE username = ?", (user_data["username"],))
        if not cursor.fetchone():
            hashed = hash_password(user_data["password"])
            cursor.execute("""
            INSERT INTO users (username, email, hashed_password, full_name, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (user_data["username"], user_data["email"], hashed, user_data["full_name"], user_data["role"], now))
            print(f"  + User '{user_data['username']}' ({user_data['role']}) created")
    conn.commit()
    conn.close()

    # Seed Genesis ledger entry if ledger is empty
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as count FROM ledger_entries")
    count = cursor.fetchone()["count"]
    conn.close()

    if count == 0:
        print("[WARDEN SEED] Creating Genesis ledger record...")
        append_ledger_entry(
            event_type="GENESIS",
            actor="SYSTEM",
            payload={
                "system": "WARDEN Governance Engine",
                "version": "1.0.0",
                "genesis_time": now,
                "message": "Tamper-evident cryptographically chained ledger initialized."
            }
        )

    # Seed agent passports
    print("[WARDEN SEED] Seeding Agent Passports...")
    for agent_data in SEED_AGENTS:
        existing = get_agent_by_id(agent_data["agent_id"])
        if not existing:
            created = create_agent(
                agent_id=agent_data["agent_id"],
                name=agent_data["name"],
                owner=agent_data["owner"],
                purpose=agent_data["purpose"],
                allowed_actions=agent_data["allowed_actions"],
                allowed_data_classes=agent_data["allowed_data_classes"],
                max_amount=agent_data["max_amount"],
                status=agent_data["status"],
                custom_api_key=agent_data["custom_api_key"]
            )
            print(f"  + Agent '{agent_data['agent_id']}' created (API Key: {created.get('api_key')})")

    # Verify ledger integrity
    verification = verify_ledger_chain()
    print(f"[WARDEN SEED] Chain verification: {verification['message']}")
    print("[WARDEN SEED] Seeding complete! All credentials ready.")

if __name__ == "__main__":
    seed_database()
