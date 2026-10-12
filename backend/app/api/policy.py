"""Policy document + OPA enforcement bundle management.

There are NO built-in company policies. The dashboard shows exactly what was
uploaded:
  * Policy document (PDF) -> human-readable record, parsed for display.
  * OPA bundle (.zip of .rego) -> what OPA actually enforces on every agent
    action request (checked pre-execution by WARDEN).
"""
import io
import json
import re
import subprocess
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status

from app.api.deps import get_current_user, require_roles
from app.config import settings
from app.db import get_connection
from app.services.auth_service import decode_access_token

router = APIRouter(prefix="", tags=["Policy"])

DOC_NAME = "Company_Policies.pdf"
MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_BUNDLE_BYTES = 5 * 1024 * 1024

# State lives OUTSIDE the OPA bundle dir: OPA loads *.rego/*.json recursively,
# so metadata placed inside policies/ would pollute enforcement.
_STATE_DIR = Path(__file__).resolve().parent.parent.parent.parent / ".warden_state"
_DOC_META_FILE = _STATE_DIR / "document_meta.json"
_PARSED_FILE = _STATE_DIR / "parsed_policies.json"
_BUNDLE_META_FILE = _STATE_DIR / "bundle_meta.json"


def _bundle_dir() -> Path:
    return Path(settings.OPA_BUNDLE_DIR)


def _doc_path() -> Path:
    return _bundle_dir() / DOC_NAME


# ---------------------------------------------------------------------------
# Uploaded PDF document: parse + serve
# ---------------------------------------------------------------------------

def _read_doc_meta() -> dict | None:
    try:
        return json.loads((_STATE_DIR / "document_meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _read_parsed() -> list:
    try:
        data = json.loads(_PARSED_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _extract_pdf_text(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    if not reader.pages:
        raise ValueError("PDF has no pages")
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _parse_policy_text(text: str) -> list[dict]:
    """Best-effort structure: headed policies first, paragraph chunks as fallback."""
    pats = [re.compile(r"^(C-\d+)\s*[:.\-–]\s*(.+)$"),
            re.compile(r"^([Pp]olicy\s+\d+)\s*[:.\-–]\s*(.+)$"),
            re.compile(r"^(\d{1,2})\.\s+([A-Z].{3,90})$")]
    items, cur = [], None
    for raw in text.splitlines():
        ln = raw.strip()
        if not ln or len(ln) > 400:
            if cur and len(ln) > 1:
                cur["text"] = (cur["text"] + " " + ln).strip()[:1500]
            continue
        m = next((mm for p in pats if (mm := p.match(ln))), None)
        if m:
            cur = {"id": m.group(1), "title": m.group(2).strip(), "text": ""}
            items.append(cur)
        elif cur:
            cur["text"] = (cur["text"] + " " + ln).strip()[:1500]
    items = [it for it in items if it["title"] or it["text"]]
    if not items:
        paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        for i, p in enumerate(paras[:20], 1):
            words = p.split()
            items.append({"id": f"P-{i:02d}",
                          "title": " ".join(words[:8]) + ("…" if len(words) > 8 else ""),
                          "text": p[:1200]})
    return items


def _probe_opa() -> dict:
    """Check the live OPA engine; never raise (status page must always render)."""
    started = time.time()
    try:
        with httpx.Client(timeout=2.0) as client:
            res = client.post(settings.OPA_URL, json={"input": {
                "agent": {"status": "active", "allowed_actions": ["ping"],
                          "allowed_data_classes": ["public"], "max_amount": 1.0},
                "action": "ping", "data_class": "public", "amount": 0.0, "params": {}}})
        ms = round((time.time() - started) * 1000, 1)
        if res.status_code == 200:
            result = res.json().get("result", {})
            if isinstance(result.get("allow"), bool):
                return {"reachable": True, "latency_ms": ms, "engine": "opa",
                        "note": "Live OPA engine evaluates every action request."}
        return {"reachable": False, "latency_ms": ms, "engine": "python_fallback",
                "note": f"OPA answered HTTP {res.status_code}; using built-in fallback."}
    except Exception as e:
        return {"reachable": False, "latency_ms": None, "engine": "python_fallback",
                "note": f"OPA unreachable ({e}); using built-in fallback."}


@router.get("/policy/status")
@router.get("/v1/policy/status")
def policy_status(user: dict = Depends(get_current_user)):
    probe = _probe_opa()
    return {
        "opa_url": settings.OPA_URL,
        "bundle_files": _list_rego(),
        "bundle_meta": _read_bundle_meta(),
        "document": _read_doc_meta(),
        "rules": len(_read_parsed()),
        "checked_on": "every agent action request (pre-execution)",
        **probe,
    }


@router.get("/policy/rules")
@router.get("/v1/policy/rules")
def policy_rules(user: dict = Depends(get_current_user)):
    return {"policies": _read_parsed(), "document": _read_doc_meta()}


def _user_from_header_or_token(request: Request) -> dict:
    """Auth for file downloads: Authorization header first, ?token= fallback."""
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.query_params.get("token", "")
    payload = decode_access_token(token) if token else None
    username = (payload or {}).get("sub")
    if username:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT username, role FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"username": row["username"], "role": row["role"]}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")


@router.get("/policy/pdf")
@router.get("/v1/policy/pdf")
def policy_pdf(request: Request):
    _user_from_header_or_token(request)
    path = _doc_path()
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No policy document uploaded yet.")
    return Response(
        content=path.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={DOC_NAME}"},
    )


@router.post("/policy/document")
@router.post("/v1/policy/document")
async def upload_document(file: UploadFile = File(...),
                          user: dict = Depends(require_roles(["admin", "risk_lead"]))):
    """Upload THE company policy PDF. It becomes the displayed record."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="PDF too large (max 10 MB).")
    if not data[:4] == b"%PDF":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Upload must be a PDF file.")
    path = _doc_path()
    path.write_bytes(data)
    try:
        items = _parse_policy_text(_extract_pdf_text(path))
    except Exception as e:
        try:
            path.unlink()
        except OSError:
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Could not read that PDF: {e}")
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    _PARSED_FILE.write_text(json.dumps(items), encoding="utf-8")
    meta = {"name": file.filename or DOC_NAME, "uploaded_by": user["username"],
            "uploaded_at": datetime.now(timezone.utc).isoformat()}
    (_STATE_DIR / "document_meta.json").write_text(json.dumps(meta), encoding="utf-8")
    return {"document": meta, "policies_found": len(items),
            "message": f"Policy document '{meta['name']}' is now the active record ({len(items)} sections). Upload the matching OPA bundle below for enforcement."}


# ---------------------------------------------------------------------------
# OPA bundle upload: .zip of .rego files; OPA hot-swaps to it immediately.
# ---------------------------------------------------------------------------

def _list_rego() -> list[str]:
    d = _bundle_dir()
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.glob("*.rego") if p.is_file())


def _read_bundle_meta() -> dict:
    try:
        return json.loads(_BUNDLE_META_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"name": "active bundle", "uploaded_by": None, "uploaded_at": None,
                "files": _list_rego()}


def _opa_healthy(timeout: float = 2.0) -> bool:
    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.get(f"http://{settings.OPA_ADDR}/health")
        return res.status_code == 200
    except Exception:
        return False


def _opa_stop() -> None:
    subprocess.run(["pkill", "-f", "opa run --server"], capture_output=True, timeout=10)
    for _ in range(20):
        if not _opa_healthy(timeout=0.5):
            return
        time.sleep(0.5)


def _opa_start() -> None:
    binary = settings.OPA_BINARY_PATH
    if not Path(binary).is_file():
        raise RuntimeError(f"OPA binary not found at {binary}")
    log = open("/tmp/opa.log", "ab")
    subprocess.Popen([binary, "run", "--server", "--addr", settings.OPA_ADDR,
                      str(_bundle_dir())],
                     stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                     start_new_session=True, close_fds=True)
    for _ in range(30):
        if _opa_healthy(timeout=0.5):
            return
        time.sleep(0.5)
    raise RuntimeError("OPA server did not become healthy after restart")


def _activate_bundle(new_files: dict[str, str], meta: dict) -> list[str]:
    """Swap .rego files, restart OPA, rollback to previous set on any failure."""
    bundle = _bundle_dir()
    bundle.mkdir(parents=True, exist_ok=True)
    previous = {name: (bundle / name).read_text(encoding="utf-8") for name in _list_rego()}
    try:
        for name in previous:
            if name not in new_files:
                (bundle / name).unlink()
        for name, text in new_files.items():
            (bundle / name).write_text(text, encoding="utf-8")
        _opa_stop()
        _opa_start()
    except Exception:
        for name in new_files:
            try:
                (bundle / name).unlink()
            except OSError:
                pass
        for name, text in previous.items():
            (bundle / name).write_text(text, encoding="utf-8")
        try:
            _opa_stop()
            _opa_start()
        except Exception:
            pass
        raise
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    _BUNDLE_META_FILE.write_text(json.dumps(meta), encoding="utf-8")
    return sorted(new_files)


def _extract_bundle_upload(data: bytes) -> dict[str, str]:
    """Validate a .zip upload and return {filename: rego_text} or raise 400."""
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Upload must be a .zip file.")
    files: dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename.replace("\\", "/").lstrip("/")
            if name.startswith("..") or "/../" in name or not name.lower().endswith(".rego"):
                continue
            base = name.rsplit("/", 1)[-1]
            if not base:
                continue
            with zf.open(info) as fh:
                files[base] = fh.read().decode("utf-8", errors="strict")
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Zip contains no .rego files.")
    if not any(re.search(r"^package\s+warden\b", text, re.MULTILINE) for text in files.values()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Bundle must declare 'package warden' (WARDEN queries /v1/data/warden).")
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for name, text in files.items():
            (tmpdir / name).write_text(text, encoding="utf-8")
        proc = subprocess.run([settings.OPA_BINARY_PATH, "check", str(tmpdir)],
                              capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"OPA rejected the bundle: {(proc.stderr or proc.stdout)[:800]}")
    return files


@router.post("/policy/bundle")
@router.post("/v1/policy/bundle")
async def upload_bundle(file: UploadFile = File(...),
                        user: dict = Depends(require_roles(["admin", "risk_lead"]))):
    """Upload a .zip of .rego policies; OPA hot-swaps to it immediately."""
    data = await file.read()
    if len(data) > MAX_BUNDLE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Bundle too large (max 5 MB).")
    new_files = _extract_bundle_upload(data)
    meta = {"name": file.filename or "uploaded bundle", "uploaded_by": user["username"],
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "files": sorted(new_files)}
    try:
        active = _activate_bundle(new_files, meta)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Bundle valid but OPA restart failed (rolled back): {e}")
    probe = _probe_opa()
    return {"uploaded": active, "meta": meta, "opa": probe,
            "message": f"OPA now enforces {len(active)} uploaded rule file(s) on every agent request."}
