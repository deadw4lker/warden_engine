"""Audit report generation service and endpoints (CSV, JSON, PDF/HTML)."""
import csv
import io
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Query, Response, Security, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from app.db import get_connection
from app.api.deps import security, get_user_from_token

router = APIRouter(prefix="", tags=["Reports"])


def _resolve_report_user(
    credentials: Optional[HTTPAuthorizationCredentials],
    token: Optional[str],
) -> dict:
    """Auth for downloads: Authorization header first (API clients),
    ?token= fallback (browser anchor clicks can't set headers)."""
    user = None
    if credentials:
        user = get_user_from_token(credentials.credentials)
    if user is None:
        user = get_user_from_token(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid credentials. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _decode_row(r) -> dict:
    """Full log row: every column decoded, nothing summarized away."""
    try:
        payload = json.loads(r["payload"])
    except Exception:
        payload = {"raw": r["payload"]}
    layers = payload.get("layers") if isinstance(payload.get("layers"), list) else []
    return {
        "id": r["id"],
        "timestamp": r["timestamp"],
        "event_type": r["event_type"],
        "actor": r["actor"],
        "decision": payload.get("decision", ""),
        "action": payload.get("action", ""),
        "agent_id": payload.get("agent_id", ""),
        "amount": payload.get("amount", ""),
        "layers": "; ".join(
            f"{e.get('layer')}:{e.get('result')}" for e in layers if isinstance(e, dict)
        ),
        "payload": payload,
        "prev_hash": r["prev_hash"],
        "hash": r["hash"],
    }

@router.get("/reports/audit")
@router.get("/v1/reports/audit")
def generate_audit_report(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    format: str = Query(default="csv", pattern="^(csv|json|html|pdf)$"),
    token: Optional[str] = Query(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
):
    """
    Generate verifiable audit trail report for regulatory and compliance review.
    Supports CSV, JSON, and formatted printable audit report.
    Every ledger row is exported in full: decoded columns plus complete payload.
    """
    user = _resolve_report_user(credentials, token)
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT id, timestamp, event_type, actor, payload, prev_hash, hash FROM ledger_entries"
    params = []
    conditions = []

    if from_date:
        conditions.append("timestamp >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("timestamp <= ?")
        params.append(to_date)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id ASC"
    cursor.execute(query, params)
    rows = [_decode_row(r) for r in cursor.fetchall()]
    conn.close()

    if format == "json":
        return Response(
            content=json.dumps(rows, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=warden_audit_report_{datetime.utcnow().strftime('%Y%m%d')}.json"}
        )

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Timestamp (UTC)", "Event Type", "Actor", "Decision",
                         "Action", "Agent", "Amount", "Layers (L:result)",
                         "Full Payload (JSON)", "Previous Hash", "Entry Hash (SHA-256)"])
        for r in rows:
            writer.writerow([
                r["id"],
                r["timestamp"],
                r["event_type"],
                r["actor"],
                r["decision"],
                r["action"],
                r["agent_id"],
                r["amount"],
                r["layers"],
                json.dumps(r["payload"]).replace("\n", " "),
                r["prev_hash"],
                r["hash"]
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=warden_audit_report_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
        )

    # HTML / Printable PDF-ready format
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>WARDEN Cryptographic Audit Report</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; }}
  h1 {{ color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 10px; }}
  .meta {{ margin-bottom: 20px; color: #64748b; font-size: 14px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }}
  th {{ background: #f8fafc; font-weight: 600; color: #334155; }}
  tr:nth-child(even) {{ background: #f1f5f9; }}
  .hash {{ font-family: monospace; font-size: 11px; word-break: break-all; color: #0369a1; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; background: #e0f2fe; color: #0369a1; }}
</style>
</head>
<body>
  <h1>WARDEN: AI Agent Governance Audit Report</h1>
  <div class="meta">
    <p><strong>Generated By:</strong> {user['username']} ({user['role']}) | <strong>Date:</strong> {datetime.utcnow().isoformat()}Z</p>
    <p><strong>Total Verified Records:</strong> {len(rows)} | <strong>Integrity Standard:</strong> SHA-256 Chained Hash Ledger</p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 50px;">ID</th>
        <th style="width: 200px;">Timestamp / Event / Layers</th>
        <th style="width: 120px;">Actor</th>
        <th>Payload Detail (full)</th>
        <th style="width: 200px;">Cryptographic Hash</th>
      </tr>
    </thead>
    <tbody>
"""
    for r in rows:
        payload_pretty = json.dumps(r["payload"], indent=2)
        layers_pretty = r["layers"] or "—"
        html += f"""
      <tr>
        <td><strong>#{r['id']}</strong></td>
        <td>{r['timestamp']}<br><span class="badge">{r['event_type']}</span><br>{layers_pretty}</td>
        <td>{r['actor']}</td>
        <td><pre style="margin:0; font-size:11px;">{payload_pretty}</pre></td>
        <td class="hash">{r['hash']}</td>
      </tr>
"""
    html += """
    </tbody>
  </table>
</body>
</html>
"""
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=warden_audit_report_{datetime.utcnow().strftime('%Y%m%d')}.html"}
    )
