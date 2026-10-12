# Deploy Everything on Render (free tier) — Runbook

## 0. Prepare the code (done in repo)

- `render.yaml` (here) → `warden-backend` (Docker, `$PORT`-aware) + `warden-console` (static, `VITE_API_BASE` wired from backend host).
- `agento/render.yaml` → `shopassist-api` (Docker, `chat_api.py`).
- Secrets are NEVER in code — they go in Render Dashboard → Environment.

## 1. Push to GitHub

- This repo → e.g. `warden_engine` (commit `render.yaml`, `backend/Dockerfile`, `frontend/src/api.js`).
- `/home/deadw4lker/agento` → new repo e.g. `shopassist-api` (`git init`, commit all + `Dockerfile`, `requirements-api.txt`, `render.yaml`).

## 2. Deploy backend + console

Render → New → Blueprint → select `warden_engine` → Apply.
Set these env vars when prompted (values handed over separately):
- `warden-backend`: `JWT_SECRET`, `KEY_ENCRYPTION_SECRET` (the rest prefilled).
- `warden-console`: nothing (uses backend host automatically).
- Wait for both green. Console URL: `https://warden-console.onrender.com`.

## 3. Deploy the agent API

Render → New → Blueprint → select `shopassist-api` → Apply.
Set env vars: `WARDEN_API_KEY`, `APP_API_KEY`, `LLM_API_KEY`
(`WARDEN_BASE_URL` prefilled to the backend above — edit it if your
backend service got a different name).
- URL: `https://shopassist-api.onrender.com`.

## 4. Register the bot (required after every free-tier wipe)

Free SQLite resets on restart. Recovery (1 min):
1. Console → sign up / log in → **Connect → Register agent**:
   `shopassist_bot`, actions `issue_refund, issue_replacement, update_record,
   create_ticket, view_order`, data `public, internal`, max `100000`.
2. Copy the new `wrd_...` key → Render `shopassist-api` → Environment →
   update `WARDEN_API_KEY` → Save (auto-redeploys).

## 5. Phones

- APK default server is already `https://shopassist-api.onrender.com`.
- Each phone: open app → ⚙ → paste `APP_API_KEY` once → chats forever.
- First launch after idle can take ~50s (free cold start); the app retries.

## 6. Local dev unaffected

- `VITE_API_BASE` unset → console talks to `http://127.0.0.1:8000`.
- `APP_API_KEY` unset on laptop → chat API open on LAN.
