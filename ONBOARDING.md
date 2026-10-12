# Connect Your AI Agent to WARDEN — Business Onboarding

Send this page to any business (e.g. a ticket-booking company) that wants
WARDEN governance for their AI agent. Three steps, ~10 minutes.

## Step 1 — Register the agent (in the console, no admin needed)

1. Sign up at the WARDEN console → open **Connect → Register agent**.
2. Fill in:
   - **Agent name**: `Ticket Booking Bot`
   - **Purpose**: `Books, cancels and refunds event tickets`
   - **Allowed actions**: `book_ticket, cancel_ticket, issue_refund, view_schedule`
   - **Data classes**: `public, internal`
   - **Max amount**: `50000`
3. Click **Register agent & issue key** → copy the `wrd_...` API key **now**
   (shown once; rotate from the same page if lost).

Guardrails (enforced automatically): globally-restricted actions
(`delete_database`, …) are rejected, `restricted` data is rejected, budget is
capped at Rs 1,00,000, and you become the agent's owner. Higher limits need an
admin — ask your WARDEN operator.

## Step 2 — Wrap your tools (5 lines per tool)

```bash
pip install warden-sdk httpx
```

```python
from warden_sdk import WardenClient

warden = WardenClient(
    api_url="https://YOUR-WARDEN-URL",  # your operator gives you this
    agent_id="ticketbooker_bot",        # from Step 1
    api_key="wrd_...",                  # from Step 1, server-side only
)

@warden.guard(action="book_ticket", data_class="internal",
              reversibility="partially", amount_param="total_fare")
def book_ticket(customer_id, show_id, seats, total_fare):
    ...  # your existing payment + seat-lock code — unchanged
```

Your business logic doesn't change. The decorator asks WARDEN **before**
executing and only runs on `ALLOW` (or after a human approves `PENDING_APPROVAL`).
Wrap every function that touches money, seats, or customer data. Read-only
lookups (`view_schedule`) need no guard.

## Step 3 — What happens at runtime

| Customer action | WARDEN verdict | Your customer sees |
|---|---|---|
| Normal booking, ₹800, 2 seats | **ALLOW** (low risk) | Books instantly ✅ |
| Bulk booking, ₹80,000, 40 seats | **PENDING_APPROVAL** → manager approves in console → books | ⏳ held, then ✅ |
| Cancelling *someone else's* ticket | **BLOCKED** (ownership check) | ⛔ refused |
| Agent tries an out-of-scope action | **BLOCKED + agent auto-paused** | Agent frozen until a human resumes it |
| Same message spammed repeatedly | Warned, then sender blocked | ⛔ cut off, logged |

Every verdict is written to WARDEN's tamper-evident ledger with decision ID,
risk score and explanation — the audit trail you show your auditors.

## Operating your connection

- **Console → Connect → Register agent → Key management**: inspect which key
  is live (`key wrd_... · active`), **Rotate** a leaked key (old key dies
  instantly, new key shown once).
- **Console → Agents**: pause/resume your agent (kill switch).
- **Console → Activity log / Approvals**: watch every governed call, approve
  big bookings.
- Installed the ShopAssist-style phone app? It keeps working — governance is
  server-side and invisible to customers until something needs a human.

## Path B — Connect a bot / LLM key instead

If your "agent" is an LLM API key or a bot server with an OpenAI-compatible
endpoint: **Connect → Connect bot / LLM** → pick the provider, paste the key
(plus bot link for custom endpoints) → WARDEN encrypts it, health-tests it
(`Reply OK`) and shows `valid`. Drive it from the same page with a governed
task. LAN links (e.g. `http://192.168.x.x:8502`) need `ALLOW_LOCAL_UPSTREAMS=true`
on the WARDEN server.
