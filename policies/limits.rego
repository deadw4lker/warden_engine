package warden.policy

import rego.v1

# REFUND LIMIT RULE (max $500 per transaction for automated run)
check_refund_limit if {
	input.action_name == "issue_refund"
	input.amount <= 500.0
}

check_refund_limit if input.action_name != "issue_refund"

# REPLACEMENT LIMITS (max 2 item replacements per order without review)
check_replacement_limits if {
	input.action_name == "issue_replacement"
	input.affected_records <= 2
}

check_replacement_limits if input.action_name != "issue_replacement"

# MULTIPLE USER REQUEST / VELOCITY CHECK (block brute-force / flood)
# Prevents a compromised or rogue agent from flooding the system
# (>10 requests in a short window or shared rapid pattern)
check_rate_velocity if {
	input.metadata.recent_request_count <= 10
	input.metadata.velocity_window_seconds >= 60
}

# Soft escalation (refunds between $501 and $5000 require human review)
exceeds_soft_limits if {
	input.action_name == "issue_refund"
	input.amount > 500.0
	input.amount <= 5000.0
}
