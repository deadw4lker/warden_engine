const decisionLabels = {
  ALLOW: 'Allowed',
  ACTION_ALLOWED: 'Allowed',
  APPROVED: 'Approved',
  ACTION_APPROVED: 'Approved',
  PENDING: 'Needs review',
  PENDING_APPROVAL: 'Needs review',
  APPROVAL_REQUESTED: 'Needs review',
  ESCALATED: 'Sent for further review',
  APPROVAL_ESCALATED: 'Sent for further review',
  BLOCKED: 'Stopped by WARDEN',
  DENY: 'Stopped by WARDEN',
  ACTION_BLOCKED: 'Stopped by WARDEN',
  REJECTED: 'Declined',
  ACTION_REJECTED: 'Declined',
  TIMEOUT: 'Review time expired',
  TIMED_OUT: 'Review time expired',
  APPROVAL_TIMEOUT: 'Review time expired',
  HUMAN_ONLY: 'Needs a person to do it',
  KILL_SWITCH: 'Agent paused automatically',
  KILL_SWITCH_TRIGGERED: 'Agent paused automatically',
  SYSTEM: 'System update',
};

const eventLabels = {
  ACTION_ALLOWED: 'Action allowed',
  ACTION_APPROVED: 'Action approved',
  ACTION_BLOCKED: 'Action stopped',
  ACTION_REJECTED: 'Action declined',
  ACTION_EXECUTED: 'Action completed',
  APPROVAL_REQUESTED: 'Review requested',
  APPROVAL_ESCALATED: 'Sent for further review',
  APPROVAL_TIMEOUT: 'Review time expired',
  KILL_SWITCH_TRIGGERED: 'Agent paused automatically',
  AGENT_REGISTERED: 'Agent added',
  AGENT_PAUSED: 'Agent paused',
  AGENT_RESUMED: 'Agent resumed',
  GENESIS: 'Activity log started',
  SLA_MONITOR: 'Review deadline checked',
};

const roleLabels = {
  admin: 'Administrator',
  approver: 'Reviewer',
  risk_lead: 'Risk lead',
  risk_officer: 'Security reviewer',
  executive: 'Company leader',
  auditor: 'View only',
};

const dataClassLabels = {
  public: 'Public information',
  internal: 'Company information',
  confidential: 'Sensitive information',
  restricted: 'Highly restricted information',
};

const riskLabels = {
  LOW: 'Low impact',
  MEDIUM: 'Medium impact',
  HIGH: 'High impact',
  RESTRICTED: 'Needs a person to handle',
  SOFT_DENY: 'Stopped by a company rule',
  BLOCKED: 'Stopped',
};

const layerLabels = {
  L1: 'Agent check',
  L2: 'Access check',
  L3: 'Allowed action check',
  L4: 'Company rules check',
};

export function humanizeAction(value) {
  if (!value) return 'Unknown action';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function humanizeIdentifier(value) {
  if (!value) return 'Unknown';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function humanizeDecision(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return decisionLabels[normalized] || humanizeAction(value);
}

export function humanizeEvent(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return eventLabels[normalized] || humanizeAction(value);
}

export function humanizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return roleLabels[normalized] || humanizeAction(value);
}

export function humanizeAgentStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'active') return 'Running';
  if (normalized === 'paused') return 'Paused';
  if (normalized === 'revoked') return 'Access removed';
  return humanizeAction(value || 'Unknown');
}

export function humanizeConnectionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    valid: 'Connected',
    active: 'Connected',
    invalid_key: 'Check access key',
    unreachable: 'Could not connect',
    paused: 'Paused',
    revoked: 'Disconnected',
  };
  return labels[normalized] || humanizeAction(value || 'Unknown');
}

export function humanizeDataClass(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return dataClassLabels[normalized] || humanizeAction(value);
}

export function humanizeRisk(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return riskLabels[normalized] || humanizeAction(value);
}

export function humanizeLayer(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return layerLabels[normalized] || humanizeAction(value);
}

export function describeLayer(entry) {
  const layer = String(entry?.layer || '').toUpperCase();
  const passed = entry?.result === 'pass';
  const detail = String(entry?.detail || '').toLowerCase();

  if (layer === 'L1') {
    if (passed) return 'The agent is registered and running.';
    return detail.includes('not registered')
      ? 'This agent has not been added to WARDEN yet.'
      : 'This agent is paused or unavailable.';
  }
  if (layer === 'L2') {
    if (!passed) return 'The requester could not be confirmed as having access.';
    if (detail.includes('owns')) return 'The requester has access to this item.';
    return 'The requester information was checked.';
  }
  if (layer === 'L3') {
    return passed
      ? 'This action is on the agent’s allowed list.'
      : 'This action is outside the agent’s allowed list.';
  }
  if (layer === 'L4') {
    if (!passed) return 'A company rule stopped this request.';
    if (detail.includes('blast_radius')) return 'The possible impact was checked.';
    return 'The request passed the company rules.';
  }
  return entry?.detail || 'This check was recorded.';
}
