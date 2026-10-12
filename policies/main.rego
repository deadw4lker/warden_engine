package warden.policy

import rego.v1

default allow := false

default decision := "BLOCK"

default reason := "Denied by default security policy"

# MAIN EVALUATION RULE
decision_result := "ALLOW" if {
	not is_restricted_action
	check_refund_limit
	check_replacement_limits
	check_rate_velocity
} else := "BLOCK" if {
	is_restricted_action
} else := "PENDING_APPROVAL" if {
	# Exceeds standard bounds but isn't strictly prohibited: escalate to human approval
	not is_restricted_action
	exceeds_soft_limits
} else := "BLOCK"

# Public outputs
decision := decision_result

allow if decision_result == "ALLOW"

reason := "Action permitted by policy" if decision_result == "ALLOW"

reason := "Action exceeds automated limits; human approval required" if decision_result == "PENDING_APPROVAL"

reason := "Restricted action blocked" if is_restricted_action
