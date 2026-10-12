"""Decision Engine orchestrating Policy checks, Blast Radius scoring,
Kill Switch enforcement, Approvals creation, and Tamper-evident Ledger recording.
Fail-closed by design: Any unexpected error results in BLOCKED.
"""
import json
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from app.config import settings
from app.db import get_connection
from app.services.agent_service import get_agent_by_id, pause_agent
from app.services.policy_service import evaluate_policy, RESTRICTED_ACTIONS
from app.services.risk_service import calculate_blast_radius
from app.services.ledger_service import append_ledger_entry, get_ledger_entries, canonical_json

LAYER_ORDER = ["L1", "L2", "L3", "L4"]


def _layer(name: str, check: str, passed: bool, detail: str = ""):
    """One four-layer checklist entry (PDF sections 2-5)."""
    return {"layer": name, "check": check,
            "result": "pass" if passed else "fail", "detail": detail}


def _finish_layers(layers, stopped_at: str):
    """Mark unevaluated layers as skipped so the checklist always shows L1-L4."""
    seen = {e["layer"] for e in layers}
    out = list(layers)
    started = False
    for name in LAYER_ORDER:
        if name == stopped_at:
            started = True
            continue
        if started and name not in seen:
            out.append(_layer(name, "not evaluated", False,
                              "Stopped early: an earlier layer failed closed"))
    return out


def _intent_hash(intent: Dict[str, Any]) -> str:
    """Binding hash over the canonical intent contract (Layer 3)."""
    return hashlib.sha256(canonical_json(intent).encode("utf-8")).hexdigest()


def _blocked(
    decision_id, idempotency_key, agent_id, action, intent, requester,
    delegation_id, principal_chain, layers, amount, records, explanation,
    kill_switch: bool,
) -> Dict[str, Any]:
    """Record a Layer-2 authority denial (no kill switch: the user, not the
    agent, lacks authority) with the layer checklist, and return it."""
    current_hash = _intent_hash(intent)
    if not any(e.get("layer") == "L3" for e in layers):
        layers = layers + [_layer("L3", "intent_contract", True,
                                  f"Contract {current_hash[:12]}… bound")]
    response = {
        "decision": "BLOCKED",
        "decision_id": decision_id,
        "risk_score": 1.0,
        "risk_level": "BLOCKED",
        "explanation": explanation,
        "risk_breakdown": {},
        "layers": layers,
        "intent_hash": current_hash,
        "principal_chain": principal_chain,
    }
    response["ledger_hash"] = append_ledger_entry(
        event_type="ACTION_BLOCKED",
        actor=agent_id,
        payload={
            "decision_id": decision_id,
            "action": action,
            "amount": float(amount or 0.0),
            "intent_hash": current_hash,
            "principal_chain": principal_chain,
            "explanation": explanation,
            "kill_switch_activated": kill_switch,
            "layers": layers,
        },
    )["hash"]
    return response

async def process_action_request(
    agent_id: str,
    action: str,
    params: Optional[Dict[str, Any]] = None,
    amount: float = 0.0,
    records_affected: int = 0,
    data_class: str = "public",
    reversibility: str = "partially",
    order: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluate action request through full WARDEN governance pipeline:
    1. Passport check
    2. Policy engine evaluation (OPA or Python fallback)
    3. If hard FAIL: Auto-pause agent (Kill switch) + record BLOCKED in ledger
    3b. If soft FAIL: BLOCK the request WITHOUT pausing, return policy advice
    4. If PASS: Blast radius risk calculation (+ human review if OPA asks)
    5. Route decision:
       - RESTRICTED -> HUMAN_ONLY
       - LOW -> ALLOW
       - MEDIUM/HIGH -> PENDING_APPROVAL (create approval with evidence pack)
    """
    decision_id = f"dec_{uuid.uuid4().hex[:12]}"
    params = params or {}
    safe_amount = float(amount or 0.0)
    safe_records = int(records_affected or 0)

    # Layer 2/3 context straight from the proposal (demo scope: self-asserted
    # customer id from the chatbot; ownership is enforced in business tools).
    requester_id = params.get("customer_id") if isinstance(params, dict) else None
    owner_id = params.get("owner_id") if isinstance(params, dict) else None
    resource_id = params.get("order_id") if isinstance(params, dict) else None

    # Intent contract + principal chain carried through every verdict so the
    # dashboard scanner and ledger can show exactly what was authorized.
    intent = {
        "operation": action,
        "resource": resource_id or "",
        "amount_cap": safe_amount,
        "records": safe_records,
        "data_class": data_class,
        "params": params,
    }
    requester = (
        {"type": "customer", "id": requester_id, "verified": False}
        if requester_id else {}
    )
    principal_chain = []
    if requester:
        principal_chain.append({"role": "requester", **requester})
    principal_chain += [
        {"role": "application", "type": "service", "id": "warden-api"},
        {"role": "agent", "type": "passport", "id": agent_id},
        {"role": "action", "type": "tool", "id": action},
    ]
    delegation_id = None
    idempotency_key = None

    try:
        # 1. Fetch Agent Passport
        agent = get_agent_by_id(agent_id)
        if not agent:
            # Unregistered agent -> fail-closed
            layers = _finish_layers(
                [_layer("L1", "agent_identity", False,
                        f"Agent '{agent_id}' not registered in WARDEN registry")],
                "L1",
            )
            explanation = f"Blocked: Agent '{agent_id}' is not registered in WARDEN registry"
            ledger_record = append_ledger_entry(
                event_type="ACTION_BLOCKED",
                actor=agent_id,
                payload={
                    "decision_id": decision_id,
                    "action": action,
                    "reason": explanation,
                    "layers": layers,
                }
            )
            return {
                "decision": "BLOCKED",
                "decision_id": decision_id,
                "risk_score": 1.0,
                "risk_level": "BLOCKED",
                "explanation": explanation,
                "risk_breakdown": {},
                "ledger_hash": ledger_record["hash"],
                "layers": layers,
            }

        # ---- Layer 1: identity ----
        l1_pass = agent.get("status") == "active"
        layers = [_layer("L1", "agent_identity", l1_pass,
                         f"Passport '{agent_id}' verified; status={agent.get('status')}")]
        if not l1_pass:
            # Suspended/revoked agents stop here (PDF section 2) — no kill
            # switch: the identity is already contained, just deny + log.
            layers = _finish_layers(layers, "L1")
            explanation = (f"Blocked: Agent '{agent_id}' is not active "
                           f"(status={agent.get('status')}); suspended identities cannot propose actions")
            ledger_record = append_ledger_entry(
                event_type="ACTION_BLOCKED",
                actor=agent_id,
                payload={
                    "decision_id": decision_id,
                    "action": action,
                    "reason": explanation,
                    "layers": layers,
                }
            )
            return {
                "decision": "BLOCKED",
                "decision_id": decision_id,
                "risk_score": 1.0,
                "risk_level": "BLOCKED",
                "explanation": explanation,
                "risk_breakdown": {},
                "ledger_hash": ledger_record["hash"],
                "layers": layers,
            }

        # ---- Layer 2: actor authority over the resource ----
        # The chatbot asserts both sides (requester + resource owner); WARDEN
        # verifies them against each other. A mismatch fails closed HERE —
        # no kill switch: the *user* lacks authority, the agent only
        # misbehaved if it hid the mismatch.
        if requester_id and owner_id:
            if requester_id == owner_id:
                layers.append(_layer("L2", "authority_verified", True,
                                     f"Requester customer:{requester_id} owns "
                                     f"{resource_id or 'the resource'}"))
            else:
                layers.append(_layer("L2", "authority_verified", False,
                                     f"Requester customer:{requester_id} has no authority over "
                                     f"{resource_id or 'the resource'} "
                                     f"(owner: customer:{owner_id})"))
                layers = _finish_layers(layers, "L2")
                return _blocked(
                    decision_id, idempotency_key, agent_id, action, intent, requester,
                    delegation_id, principal_chain, layers, safe_amount, safe_records,
                    f"Blocked: customer:{requester_id} is not authorized for "
                    f"{resource_id or 'this resource'} (owner: customer:{owner_id})",
                    kill_switch=False,
                )
        elif requester_id and resource_id and not owner_id:
            # Fail closed (PDF section 2): authority over a named resource
            # cannot be established — the resource is unknown, so no one
            # can prove ownership of it. Never route to human review.
            layers.append(_layer("L2", "authority_verified", False,
                                 f"Resource {resource_id} unknown: ownership unverifiable "
                                 f"for requester customer:{requester_id}"))
            layers = _finish_layers(layers, "L2")
            return _blocked(
                decision_id, idempotency_key, agent_id, action, intent, requester,
                delegation_id, principal_chain, layers, safe_amount, safe_records,
                f"Blocked: {resource_id} does not exist or has no verifiable owner; "
                f"authority cannot be established",
                kill_switch=False,
            )
        elif requester_id:
            layers.append(_layer("L2", "requester_recorded", True,
                                 f"Requester customer:{requester_id} asserted by agent "
                                 f"(ownership enforced in business tools; unverified token)"))
        else:
            layers.append(_layer("L2", "requester_recorded", True,
                                 "No requester context supplied with proposal"))

        # 2. Policy Engine evaluation (OPA or Python fallback)
        policy_result = await evaluate_policy(
            agent=agent,
            action=action,
            data_class=data_class,
            amount=safe_amount,
            params=params,
            order=order,
            records_affected=safe_records
        )
        policy_engine = policy_result.get("engine", "unknown")

        # ---- Layer 3: action integrity (scope + restriction + binding) ----
        in_scope = action in (agent.get("allowed_actions") or [])
        not_restricted = action not in RESTRICTED_ACTIONS
        layers.append(_layer(
            "L3", "action_integrity", bool(in_scope and not_restricted),
            f"op={action} in_scope={in_scope} restricted={not not_restricted} "
            f"resource={resource_id or '—'} nonce={decision_id}",
        ))

        # 3. Check for policy violations -> KILL SWITCH
        if not policy_result.get("allow"):
            violations = policy_result.get("violations", ["Policy rule violation"])
            soft_denials = policy_result.get("soft_denials", []) or []

            # 3b. SOFT denial: block this request but keep the agent running,
            # returning the policy's advice (e.g. suggested_action).
            if not violations and soft_denials:
                advice = []
                for d in soft_denials:
                    if isinstance(d, dict):
                        text = d.get("message", d.get("rule", "denied by policy"))
                        if d.get("suggested_action"):
                            text += f" [suggested: {d['suggested_action']}]"
                        advice.append(text)
                    else:
                        advice.append(str(d))
                explanation = f"Denied by company policy (no kill switch): {'; '.join(advice)}"
                layers.append(_layer("L4", "policy_rules", False,
                                     f"Soft denial via {policy_engine}: " + "; ".join(advice)))
                layers = _finish_layers(layers, "L4")
                ledger_record = append_ledger_entry(
                    event_type="ACTION_BLOCKED",
                    actor=agent_id,
                    payload={
                        "decision_id": decision_id,
                        "action": action,
                        "amount": safe_amount,
                        "data_class": data_class,
                        "soft_denials": soft_denials,
                        "explanation": explanation,
                        "kill_switch_activated": False,
                        "layers": layers,
                    }
                )
                return {
                    "decision": "BLOCKED",
                    "decision_id": decision_id,
                    "risk_score": 0.5,
                    "risk_level": "SOFT_DENY",
                    "explanation": explanation,
                    "risk_breakdown": {"soft_denials": soft_denials},
                    "ledger_hash": ledger_record["hash"],
                    "layers": layers,
                }

            violation_summary = "; ".join(violations)
            explanation = f"Blocked: Policy rule violation: {violation_summary}"

            # TRIGGER KILL SWITCH: Auto-pause agent
            try:
                pause_agent(
                    agent_id=agent_id,
                    reason=f"Kill switch triggered by policy violation: {violation_summary}",
                    actor="WARDEN_POLICY_ENGINE",
                    is_kill_switch=True
                )
            except Exception as pe:
                print(f"[WARDEN] Error pausing agent on kill switch: {pe}")

            # Record in Ledger
            layers.append(_layer("L4", "policy_rules", False,
                                 f"Hard violation via {policy_engine}: {violation_summary}"))
            layers = _finish_layers(layers, "L4")
            ledger_record = append_ledger_entry(
                event_type="ACTION_BLOCKED",
                actor=agent_id,
                payload={
                    "decision_id": decision_id,
                    "action": action,
                    "amount": safe_amount,
                    "data_class": data_class,
                    "violations": violations,
                    "explanation": explanation,
                    "kill_switch_activated": True,
                    "layers": layers,
                }
            )

            return {
                "decision": "BLOCKED",
                "decision_id": decision_id,
                "risk_score": 1.0,
                "risk_level": "BLOCKED",
                "explanation": explanation,
                "risk_breakdown": {"violations": violations},
                "ledger_hash": ledger_record["hash"],
                "layers": layers,
            }

        # 4. Blast Radius Risk Scoring
        layers.append(_layer("L4", "policy_rules", True,
                             f"Permitted by {policy_engine}; cumulative budget: not enforced (testing scope)"))
        risk = calculate_blast_radius(
            amount=safe_amount,
            records_affected=safe_records,
            reversibility=reversibility,
            data_class=data_class,
            action=action
        )

        risk_score = risk["score"]
        risk_level = risk["risk_level"]

        # 4b. OPA asked for human review: even a LOW blast radius must go
        # through the Approvals Queue (existing MEDIUM path handles it).
        policy_reviews = policy_result.get("reviews", []) or []
        if policy_reviews and risk_level == "LOW":
            # Policy demands human review: the EFFECTIVE score must sit in the
            # MEDIUM band, or dashboards show "0.17 but needs approval".
            raw_blast_score = float(risk_score)
            risk_level = "MEDIUM"
            risk_score = max(raw_blast_score, 0.25)
            risk["score"] = risk_score
            risk["raw_blast_score"] = raw_blast_score
            risk["risk_level"] = "MEDIUM"
            risk["explanation"] = ("Human review required by company policy: "
                                   + "; ".join(policy_reviews)
                                   + f" (blast radius otherwise LOW: {risk['explanation']}; "
                                   f"effective score floored to {risk_score:.2f})")

        # 5. Route based on risk level
        layers.append(_layer("L4", "blast_radius", True,
                             f"{risk_level} (score {risk_score:.2f}) -> "
                             + ("human approval" if risk_level in ("MEDIUM", "HIGH") else risk_level.lower())))
        if risk_level == "RESTRICTED":
            explanation = f"Human execution required: {risk['explanation']}"
            ledger_record = append_ledger_entry(
                event_type="ACTION_BLOCKED",
                actor=agent_id,
                payload={
                    "decision_id": decision_id,
                    "action": action,
                    "data_class": data_class,
                    "risk_level": "RESTRICTED",
                    "explanation": explanation,
                    "layers": layers,
                }
            )
            return {
                "decision": "HUMAN_ONLY",
                "decision_id": decision_id,
                "risk_score": risk_score,
                "risk_level": "RESTRICTED",
                "explanation": explanation,
                "risk_breakdown": risk,
                "ledger_hash": ledger_record["hash"],
                "layers": layers,
            }

        if risk_level == "LOW":
            # ALLOW: Safe blast radius, executed pre-approved
            explanation = f"Approved automatically: {risk['explanation']}"
            ledger_record = append_ledger_entry(
                event_type="ACTION_ALLOWED",
                actor=agent_id,
                payload={
                    "decision_id": decision_id,
                    "action": action,
                    "amount": safe_amount,
                    "records_affected": safe_records,
                    "data_class": data_class,
                    "risk_score": risk_score,
                    "risk_level": "LOW",
                    "explanation": explanation,
                    "layers": layers,
                }
            )
            return {
                "decision": "ALLOW",
                "decision_id": decision_id,
                "risk_score": risk_score,
                "risk_level": "LOW",
                "explanation": explanation,
                "risk_breakdown": risk,
                "ledger_hash": ledger_record["hash"],
                "layers": layers,
            }

        # MEDIUM or HIGH: Requires Human Approval
        # Build evidence pack
        recent_entries = get_ledger_entries(limit=5)
        recent_history = [
            {"id": e["id"], "timestamp": e["timestamp"], "event": e["event_type"], "actor": e["actor"]}
            for e in recent_entries if e["actor"] == agent_id or e["event_type"].startswith("ACTION")
        ]

        evidence_pack = {
            "layers": layers,
            "requester": {"customer_id": requester_id} if requester_id else {},
            "resource": resource_id,
            "policy_engine": policy_engine,
            "agent_passport": {
                "agent_id": agent["agent_id"],
                "name": agent["name"],
                "owner": agent["owner"],
                "status": agent["status"],
                "max_amount": agent["max_amount"],
                "allowed_actions": agent["allowed_actions"]
            },
            "action": action,
            "params": params,
            "data_class": data_class,
            "amount": safe_amount,
            "records_affected": safe_records,
            "reversibility": reversibility,
            "policy_evaluation": policy_result,
            "risk_breakdown": risk,
            "recent_agent_history": recent_history
        }

        # Create approval record
        now = datetime.utcnow()
        sla_seconds = settings.DEFAULT_APPROVAL_SLA_SECONDS
        sla_deadline = now + timedelta(seconds=sla_seconds)

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO approval_requests (
            decision_id, agent_id, action, params, data_class, amount, records_affected,
            reversibility, risk_score, risk_level, risk_breakdown, evidence_pack,
            status, escalation_level, created_at, sla_deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'APPROVER', ?, ?)
        """, (
            decision_id, agent_id, action, json.dumps(params), data_class, safe_amount,
            safe_records, reversibility, risk_score, risk_level, json.dumps(risk),
            json.dumps(evidence_pack), now.isoformat() + "Z", sla_deadline.isoformat() + "Z"
        ))
        conn.commit()
        conn.close()

        # Record in ledger
        ledger_record = append_ledger_entry(
            event_type="APPROVAL_REQUESTED",
            actor=agent_id,
            payload={
                "decision_id": decision_id,
                "action": action,
                "amount": safe_amount,
                "records_affected": safe_records,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "sla_seconds": sla_seconds,
                "layers": layers,
            }
        )

        # Update approval with ledger hash
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE approval_requests SET ledger_hash = ? WHERE decision_id = ?", (ledger_record["hash"], decision_id))
        conn.commit()
        conn.close()

        explanation = f"Pending Human Approval: {risk['explanation']}. Awaiting reviewer sign-off."
        return {
            "decision": "PENDING_APPROVAL",
            "decision_id": decision_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "explanation": explanation,
            "risk_breakdown": risk,
            "evidence_pack": evidence_pack,
            "ledger_hash": ledger_record["hash"],
            "layers": layers,
        }

    except Exception as e:
        # FAIL-CLOSED GUARANTEE
        fail_explanation = f"Blocked (Fail-Closed): Governance error during pre-execution evaluation: {str(e)}"
        try:
            append_ledger_entry(
                event_type="SYSTEM_ALERT",
                actor=agent_id,
                payload={"decision_id": decision_id, "error": str(e), "decision": "BLOCKED"}
            )
        except Exception:
            pass

        return {
            "decision": "BLOCKED",
            "decision_id": decision_id,
            "risk_score": 1.0,
            "risk_level": "BLOCKED",
            "explanation": fail_explanation,
            "risk_breakdown": {"error": str(e)}
        }
