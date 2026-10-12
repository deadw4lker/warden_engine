"""Open Policy Agent (OPA) client and Python fallback policy evaluator.
Evaluates agent permissions, allowed scope, budget limits, data classes, and restricted actions.
Speaks two OPA dialects:
  * legacy: top-level {allow, violations, soft_denials?, reviews?}
  * bundle-style: nested under package warden.* with {allow, decision, reason}
    (ALLOW / BLOCK / PENDING_APPROVAL). PENDING routes to human approval.
Also supplies request metadata (recent request count for velocity rules).
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import httpx
from app.config import settings
from app.db import get_connection

RESTRICTED_ACTIONS = [
    "delete_database",
    "drop_table",
    "bulk_export_pii",
    "modify_iam_roles",
    "bypass_governance",
    "execute_arbitrary_code"
]

def evaluate_python_rules(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pure Python rule evaluator implementing the exact semantics of policies/warden.rego.
    Guarantees deterministic pre-execution policy enforcement even without OPA running.
    """
    violations: List[str] = []
    agent = input_data.get("agent", {})
    action = input_data.get("action", "")
    data_class = input_data.get("data_class", "public")
    amount = float(input_data.get("amount", 0.0) or 0.0)

    # 1. Agent status must be active
    status = agent.get("status", "unknown")
    if status != "active":
        violations.append(f"Agent status is '{status}', must be 'active'")

    # 2. Globally restricted actions are permanently denied to AI agents
    if action in RESTRICTED_ACTIONS:
        violations.append(f"Action '{action}' is globally restricted for AI agents (requires human execution only)")

    # 3. Action must be within agent passport scope
    allowed_actions = agent.get("allowed_actions", [])
    if action not in allowed_actions:
        violations.append(f"Action '{action}' is not in agent allowed scope: {allowed_actions}")

    # 4. Data classification must be permitted for this agent
    allowed_data_classes = agent.get("allowed_data_classes", [])
    if data_class not in allowed_data_classes:
        violations.append(f"Data classification '{data_class}' exceeds agent allowed data classes: {allowed_data_classes}")

    # 5. Amount cannot exceed agent budget cap
    max_amount = float(agent.get("max_amount", 0.0) or 0.0)
    if amount > max_amount:
        violations.append(f"Requested amount {amount} exceeds agent maximum limit of {max_amount}")

    allow = len(violations) == 0
    return {
        "allow": allow,
        "violations": violations,
        "soft_denials": [],
        "reviews": [],
        "engine": "python_fallback"
    }

async def evaluate_policy(
    agent: Dict[str, Any],
    action: str,
    data_class: str,
    amount: float,
    params: Optional[Dict[str, Any]] = None,
    order: Optional[Dict[str, Any]] = None,
    records_affected: int = 0
) -> Dict[str, Any]:
    """
    Evaluate policy using OPA HTTP endpoint if available, falling back to Python evaluator.
    Passes through soft_denials (block without kill switch) and reviews
    (allowed but needs human approval) when the OPA bundle provides them.
    """
    input_data = {
        "agent": {
            "agent_id": agent.get("agent_id"),
            "name": agent.get("name"),
            "owner": agent.get("owner"),
            "status": agent.get("status"),
            "allowed_actions": agent.get("allowed_actions", []),
            "allowed_data_classes": agent.get("allowed_data_classes", []),
            "max_amount": float(agent.get("max_amount", 0.0) or 0.0),
        },
        "action": action,
        "action_name": action,  # bundle-style bundles reason over action_name
        "data_class": data_class,
        "amount": float(amount or 0.0),
        "affected_records": int(records_affected or 0),  # bundle-style alias
        "params": params or {},
        "order": order or {},
        "metadata": _request_metadata(agent.get("agent_id", "")),
    }

    # Try OPA HTTP if configured and reachable
    if settings.OPA_URL:
        try:
            async with httpx.AsyncClient(timeout=settings.OPA_TIMEOUT_SECONDS) as client:
                resp = await client.post(settings.OPA_URL, json={"input": input_data})
                if resp.status_code == 200:
                    result = resp.json().get("result", {})
                    return _read_opa_result(result)
        except Exception:
            # OPA unreachable or timeout -> graceful fallback
            pass

    # If OPA is not reached or fallback enabled:
    return evaluate_python_rules(input_data)


def _request_metadata(agent_id: str, window_seconds: int = 60) -> Dict[str, Any]:
    """Velocity context for bundle-style rules: governed requests in window."""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) AS c FROM ledger_entries
            WHERE actor = ? AND timestamp >= ? AND event_type LIKE 'ACTION_%'
        """, (agent_id, cutoff))
        count = cursor.fetchone()["c"]
        conn.close()
    except Exception:
        count = 0
    return {"agent_id": agent_id, "recent_request_count": int(count),
            "velocity_window_seconds": int(window_seconds)}


def _read_opa_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Tolerantly read either OPA dialect (legacy or bundle-style decision)."""
    node = result
    # Bundle-style bundles nest under package warden.* -> result.policy
    if not isinstance(node.get("allow"), bool) and isinstance(node.get("policy"), dict):
        node = node["policy"]
    decision = node.get("decision")
    if isinstance(decision, str):
        decision = decision.upper()
        reason = str(node.get("reason") or "Denied by OPA policy")
        if decision == "ALLOW":
            return {"allow": True, "violations": [], "soft_denials": [],
                    "reviews": [], "engine": "opa"}
        if decision == "PENDING_APPROVAL":
            # Route through the human-approval queue via the reviews channel
            return {"allow": True, "violations": [], "soft_denials": [],
                    "reviews": [reason], "engine": "opa"}
        return {"allow": False, "violations": [reason], "soft_denials": [],
                "reviews": [], "engine": "opa"}
    # Legacy shape
    return {
        "allow": bool(node.get("allow", False)),
        "violations": node.get("violations", []) or [],
        "soft_denials": node.get("soft_denials", []) or [],
        "reviews": node.get("reviews", []) or [],
        "engine": "opa"
    }
