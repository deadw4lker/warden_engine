package warden.policy

import rego.v1

default allow := false

default decision := "BLOCK"

default reason := "Denied by default security policy"

# MAIN EVALUATION RULE
# Layer 0 guard signature (input.guard, fed by Qwen3Guard) gates the decision
# FIRST when present:
#   unsafe         -> hard block (defense-in-depth backstop; L0 normally
#                     short-circuits this before the pipeline reaches L4)
#   controversial  -> human review (PENDING_APPROVAL -> SLA escalation queue)
# Legacy semantics (PDF sections 2-5) remain authoritative otherwise.
decision_result := "BLOCK" if {
	input.guard.safety == "unsafe"
} else := "PENDING_APPROVAL" if {
	input.guard.safety == "controversial"
} else := "ALLOW" if {
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

reason := "Restricted action blocked" if {
	decision_result == "BLOCK"
	is_restricted_action
}

reason := "Blocked by content guard signature (Qwen3Guard: unsafe)" if {
	decision_result == "BLOCK"
	not is_restricted_action
	input.guard.safety == "unsafe"
}

reason := "Content guard requested human review (Qwen3Guard: controversial)" if {
	decision_result == "PENDING_APPROVAL"
	input.guard.safety == "controversial"
}

reason := "Action exceeds automated limits; human approval required" if {
	decision_result == "PENDING_APPROVAL"
	input.guard.safety != "controversial"
}
