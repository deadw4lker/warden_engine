"""Agent Passport Registry endpoints.
Provides full CRUD, pause, resume, and kill switch operations.
"""
import re
import secrets
import time
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.agent import (
    AgentCreateRequest,
    AgentUpdateRequest,
    AgentPassportResponse,
    AgentStatusActionRequest,
    SelfRegisterRequest,
)
from app.services import agent_service
from app.services.policy_service import RESTRICTED_ACTIONS
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="", tags=["Agents"])

# --- Self-serve onboarding guardrails ---------------------------------------
# Businesses that sign up (auditor role) can register agents WITHOUT admin
# rights, but within a safe sandbox: no globally-restricted actions, no
# restricted data classes, capped budget, caller forced as owner, and a
# per-user hourly rate limit to prevent passport spam.
SELF_REGISTER_MAX_PER_HOUR = 10
SELF_REGISTER_MAX_AMOUNT = 100000.0
SELF_REGISTER_DATA_CLASSES = {"public", "internal"}
SELF_REGISTER_ID_RE = re.compile(r"^[a-z0-9_]{3,40}$")
_register_hits: Dict[str, List[float]] = {}


def _check_register_rate_limit(username: str) -> None:
    now = time.time()
    hits = [t for t in _register_hits.get(username, []) if now - t < 3600]
    if len(hits) >= SELF_REGISTER_MAX_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Registration limit reached ({SELF_REGISTER_MAX_PER_HOUR}/hour). Try again later.",
        )
    hits.append(now)
    _register_hits[username] = hits


def _require_owner_or_admin(agent_owner: str, user: dict) -> None:
    if user.get("role") != "admin" and agent_owner != user.get("username"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the agent owner or an admin can manage this key.",
        )

@router.get("/agents", response_model=List[AgentPassportResponse])
@router.get("/v1/agents", response_model=List[AgentPassportResponse])
def list_agents(user: dict = Depends(get_current_user)):
    """List all registered agent passports."""
    return agent_service.get_all_agents()

@router.get("/agents/{agent_id}", response_model=AgentPassportResponse)
@router.get("/v1/agents/{agent_id}", response_model=AgentPassportResponse)
def get_agent(agent_id: str, user: dict = Depends(get_current_user)):
    """Get single agent passport by agent_id."""
    agent = agent_service.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found")
    return agent

@router.post("/agents", response_model=AgentPassportResponse, status_code=status.HTTP_201_CREATED)
@router.post("/v1/agents", response_model=AgentPassportResponse, status_code=status.HTTP_201_CREATED)
def register_agent(
    req: AgentCreateRequest,
    user: dict = Depends(require_roles(["admin", "risk_lead"]))
):
    agent_id = req.agent_id
    if not agent_id or not agent_id.strip():
        slug = req.name.lower().strip().replace(" ", "_").replace("-", "_")
        slug = "".join(c for c in slug if c.isalnum() or c == "_")
        agent_id = slug or f"agent_{secrets.token_hex(4)}"

    existing = agent_service.get_agent_by_id(agent_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent '{agent_id}' already exists")

    owner = req.owner if (req.owner and req.owner.strip()) else user["username"]

    return agent_service.create_agent(
        agent_id=agent_id,
        name=req.name,
        owner=owner,
        purpose=req.purpose,
        allowed_actions=req.allowed_actions,
        allowed_data_classes=req.allowed_data_classes,
        max_amount=req.max_amount,
        status=req.status,
        custom_api_key=req.custom_api_key
    )

@router.put("/agents/{agent_id}", response_model=AgentPassportResponse)
@router.put("/v1/agents/{agent_id}", response_model=AgentPassportResponse)
def update_agent_passport(
    agent_id: str,
    req: AgentUpdateRequest,
    user: dict = Depends(require_roles(["admin", "risk_lead"]))
):
    """Update agent passport constraints or metadata."""
    updates = req.model_dump(exclude_unset=True)
    updated = agent_service.update_agent(agent_id, updates, actor=user["username"])
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found")
    return updated

@router.post("/agents/{agent_id}/pause")
@router.post("/v1/agents/{agent_id}/pause")
def pause_agent_endpoint(
    agent_id: str,
    req: Optional[AgentStatusActionRequest] = None,
    user: dict = Depends(require_roles(["admin", "approver", "risk_lead", "executive"]))
):
    """
    Emergency Kill Switch: Pause agent execution.
    Denies all subsequent pre-execution action requests immediately.
    """
    reason = req.reason if req and req.reason else f"Paused manually by {user['username']}"
    try:
        return agent_service.pause_agent(agent_id, reason=reason, actor=user["username"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/agents/{agent_id}/resume")
@router.post("/v1/agents/{agent_id}/resume")
def resume_agent_endpoint(
    agent_id: str,
    req: Optional[AgentStatusActionRequest] = None,
    user: dict = Depends(require_roles(["admin", "risk_lead", "executive"]))
):
    """Resume a paused agent passport, re-enabling governed execution."""
    reason = req.reason if req and req.reason else f"Resumed manually by {user['username']}"
    try:
        return agent_service.resume_agent(agent_id, reason=reason, actor=user["username"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/agents/register", response_model=AgentPassportResponse, status_code=status.HTTP_201_CREATED)
@router.post("/v1/agents/register", response_model=AgentPassportResponse, status_code=status.HTTP_201_CREATED)
def self_register_agent(
    req: SelfRegisterRequest,
    user: dict = Depends(get_current_user),
):
    """Self-serve onboarding: any signed-in console user can register their
    own AI agent (e.g. a ticket-booking bot) and instantly receives its API
    key. Guardrails keep this safe without admin involvement:
    restricted actions / data classes rejected, budget capped, caller forced
    as owner, 10 registrations/hour per user. The raw `api_key` is shown
    ONCE — the Connect page tells the business to copy it now."""
    _check_register_rate_limit(user["username"])

    agent_id = (req.agent_id or "").strip()
    if not agent_id:
        slug = req.name.lower().strip().replace(" ", "_").replace("-", "_")
        slug = "".join(c for c in slug if c.isalnum() or c == "_")
        agent_id = slug or f"agent_{secrets.token_hex(4)}"
    if not SELF_REGISTER_ID_RE.match(agent_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="agent_id must be 3-40 chars: lowercase letters, digits, underscores only",
        )
    if agent_service.get_agent_by_id(agent_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent '{agent_id}' already exists")

    blocked_actions = [a for a in (req.allowed_actions or []) if a in RESTRICTED_ACTIONS]
    if blocked_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Restricted actions cannot be self-registered {blocked_actions}; they require human execution only",
        )
    blocked_classes = [c for c in (req.allowed_data_classes or []) if c not in SELF_REGISTER_DATA_CLASSES]
    if blocked_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Data classes {blocked_classes} need admin approval; self-serve allows {sorted(SELF_REGISTER_DATA_CLASSES)}",
        )
    if float(req.max_amount or 0.0) > SELF_REGISTER_MAX_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"max_amount capped at {SELF_REGISTER_MAX_AMOUNT:,.0f} for self-serve; ask an admin for higher",
        )

    return agent_service.create_agent(
        agent_id=agent_id,
        name=req.name,
        owner=user["username"],
        purpose=req.purpose,
        allowed_actions=list(req.allowed_actions or []),
        allowed_data_classes=list(req.allowed_data_classes or ["public"]),
        max_amount=float(req.max_amount or 0.0),
        status="active",
    )


@router.post("/agents/{agent_id}/rotate-key")
@router.post("/v1/agents/{agent_id}/rotate-key")
def rotate_agent_key_endpoint(
    agent_id: str,
    user: dict = Depends(get_current_user),
):
    """Key management: issue a fresh API key for an agent. Owner or admin
    only. The old key stops working immediately; the new raw key is shown
    ONCE in the response."""
    agent = agent_service.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found")
    _require_owner_or_admin(agent["owner"], user)
    return agent_service.rotate_agent_key(agent_id, actor=user["username"])


@router.get("/agents/{agent_id}/key-info")
@router.get("/v1/agents/{agent_id}/key-info")
def agent_key_info_endpoint(
    agent_id: str,
    user: dict = Depends(get_current_user),
):
    """Key management: non-secret key metadata (prefix, status, owner) so a
    business can verify which key is live without ever exposing the secret."""
    agent = agent_service.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found")
    _require_owner_or_admin(agent["owner"], user)
    return {
        "agent_id": agent["agent_id"],
        "owner": agent["owner"],
        "status": agent["status"],
        "api_key_prefix": agent["api_key_prefix"],
        "updated_at": agent["updated_at"],
    }
