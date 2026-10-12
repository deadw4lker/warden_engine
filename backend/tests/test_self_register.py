"""Tests for self-serve agent onboarding (business connects its own agent).

Covers: signup -> self-register passport + key issuance -> key works on
/v1/actions/request -> guardrails (restricted actions/data classes/budget
rejected) -> rotate key (old dies, new works) -> key-info metadata.
"""
import pytest


def _signup(client, username="biz1"):
    res = client.post("/auth/signup", json={
        "username": username,
        "email": f"{username}@tickets.example.com",
        "password": "password123",
        "full_name": "Ticket Biz",
    })
    assert res.status_code == 201, res.text
    data = res.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


def test_business_can_self_register_ticket_agent(client):
    """A signed-up business registers its ticket-booking bot and the issued
    key immediately governs real actions."""
    headers = _signup(client)

    res = client.post("/v1/agents/register", headers=headers, json={
        "agent_id": "ticketbooker_bot",
        "name": "Ticket Booking Bot",
        "purpose": "Books, cancels and refunds event tickets",
        "allowed_actions": ["book_ticket", "cancel_ticket", "issue_refund", "view_schedule"],
        "allowed_data_classes": ["public", "internal"],
        "max_amount": 50000.0,
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["agent_id"] == "ticketbooker_bot"
    assert body["owner"] == "biz1"
    assert body["api_key"] and body["api_key"].startswith("wrd_")

    # Issued key works against the governance layer (issue_refund is a
    # known governed action; small amounts auto-ALLOW like demo scenario 1)
    gov = client.post("/v1/actions/request", headers={"X-Warden-Api-Key": body["api_key"]}, json={
        "agent_id": "ticketbooker_bot",
        "action": "issue_refund",
        "params": {"customer_id": "C1", "owner_id": "C1", "order_id": "ORD-1"},
        "amount": 200.0,
        "records_affected": 1,
        "data_class": "internal",
        "reversibility": "partially",
    })
    assert gov.status_code == 200, gov.text
    assert gov.json()["decision"] == "ALLOW"


def test_self_register_guardrails(client):
    """Restricted actions, restricted data classes, over-cap budgets and bad
    ids are rejected without admin involvement."""
    headers = _signup(client, "biz2")

    bad_action = client.post("/v1/agents/register", headers=headers, json={
        "name": "Evil", "purpose": "x", "allowed_actions": ["delete_database"],
    })
    assert bad_action.status_code == 400
    assert "Restricted" in bad_action.json()["detail"]

    bad_class = client.post("/v1/agents/register", headers=headers, json={
        "name": "Leaky", "purpose": "x", "allowed_data_classes": ["restricted"],
    })
    assert bad_class.status_code == 400

    over_budget = client.post("/v1/agents/register", headers=headers, json={
        "name": "Whale", "purpose": "x", "max_amount": 999999999.0,
    })
    assert over_budget.status_code == 400

    bad_id = client.post("/v1/agents/register", headers=headers, json={
        "name": "Bad", "purpose": "x", "agent_id": "BAD ID!!",
    })
    assert bad_id.status_code == 400


def test_rotate_key_kills_old_key(client):
    """Owner rotates the key: new key works, old key 401s, metadata visible."""
    headers = _signup(client, "biz3")
    reg = client.post("/v1/agents/register", headers=headers, json={
        "agent_id": "rotator_bot", "name": "Rot", "purpose": "x",
        "allowed_actions": ["view_schedule"],
    })
    old_key = reg.json()["api_key"]

    rot = client.post("/v1/agents/rotator_bot/rotate-key", headers=headers)
    assert rot.status_code == 200, rot.text
    new_key = rot.json()["api_key"]
    assert new_key != old_key

    def gov(key):
        return client.post("/v1/actions/request", headers={"X-Warden-Api-Key": key}, json={
            "agent_id": "rotator_bot", "action": "view_schedule",
            "params": {}, "amount": 0, "records_affected": 0,
            "data_class": "public", "reversibility": "reversible",
        })

    assert gov(new_key).status_code == 200
    assert gov(old_key).status_code == 401

    info = client.get("/v1/agents/rotator_bot/key-info", headers=headers)
    assert info.status_code == 200
    assert info.json()["api_key_prefix"] == new_key[:8] + "..."


def test_stranger_cannot_rotate_others_key(client, admin_headers):
    """A different user (non-owner, non-admin) gets 403 on key management."""
    owner_h = _signup(client, "owner1")
    client.post("/v1/agents/register", headers=owner_h, json={
        "agent_id": "victim_bot", "name": "V", "purpose": "x",
    })
    stranger_h = _signup(client, "stranger1")
    res = client.post("/v1/agents/victim_bot/rotate-key", headers=stranger_h)
    assert res.status_code == 403


def test_register_requires_login(client):
    """Anonymous callers cannot self-register."""
    res = client.post("/v1/agents/register", json={"name": "Anon", "purpose": "x"})
    assert res.status_code in (401, 403)
