package warden.policy

import rego.v1

# GLOBAL RESTRICTED ACTIONS (Instant Block & Kill-Switch Trigger)
restricted_actions := {
	"delete_database",
	"bulk_export_pii",
	"unauthorized_user_purge",
	"drop_table",
}

# Helper: is the action in the restricted blocklist?
is_restricted_action if restricted_actions[input.action_name]
