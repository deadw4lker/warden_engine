from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ActionRequest(BaseModel):
    agent_id: str
    action: str
    params: Dict[str, Any] = Field(default_factory=dict)
    amount: float = 0.0
    records_affected: int = 0
    data_class: str = "public"
    reversibility: str = "partially"  # reversible | partially | irreversible
    order: Optional[Dict[str, Any]] = None  # order context (total, age_days, ...) for policy rules

class ActionDecisionResponse(BaseModel):
    decision: str  # ALLOW | PENDING_APPROVAL | BLOCKED | HUMAN_ONLY
    decision_id: str
    risk_score: float
    risk_level: str
    explanation: str
    risk_breakdown: Optional[Dict[str, Any]] = None
    evidence_pack: Optional[Dict[str, Any]] = None
    ledger_hash: Optional[str] = None
    # Four-layer checklist (PDF sections 2-5): [{layer, check, result, detail}]
    # Shown on the dashboard scanner per request. Additive only.
    layers: Optional[List[Dict[str, Any]]] = None

class ActionExecutionReport(BaseModel):
    agent_id: str
    decision_id: str
    action: str
    status: str  # SUCCESS | FAILED
    result_summary: Optional[str] = None
