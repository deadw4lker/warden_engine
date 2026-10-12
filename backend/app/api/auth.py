"""Authentication and session endpoints."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from app.db import get_connection
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.services.auth_service import verify_password, hash_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="", tags=["Auth"])

@router.post("/auth/login", response_model=TokenResponse)
@router.post("/v1/auth/login", response_model=TokenResponse)
def login(creds: LoginRequest):
    """Authenticate user with username and password, return signed JWT."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, hashed_password, full_name, role, created_at FROM users WHERE username = ?", (creds.username,))
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(creds.password, row["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    user_info = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "created_at": row["created_at"]
    }

    token = create_access_token({"sub": row["username"], "role": row["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_info
    }

ALLOWED_SIGNUP_ROLES = {"admin", "approver", "risk_lead", "executive", "auditor"}

@router.post("/auth/signup", response_model=TokenResponse, status_code=201)
@router.post("/v1/auth/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest):
    """Create a new workspace user and return a signed JWT (used by the pre-login signup screen)."""
    username = payload.username.strip()
    email = payload.email.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid work email")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    role = (payload.role or "auditor").strip().lower()
    if role not in ALLOWED_SIGNUP_ROLES:
        role = "auditor"

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already registered")

    full_name = payload.full_name.strip() if payload.full_name else username
    if payload.company:
        full_name = f"{full_name} ({payload.company.strip()})" if payload.company.strip() else full_name

    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute(
        "INSERT INTO users (username, email, hashed_password, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (username, email, hash_password(payload.password), full_name, role, now),
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    user_info = {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": full_name,
        "role": role,
        "created_at": now,
    }
    token = create_access_token({"sub": username, "role": role})
    return {"access_token": token, "token_type": "bearer", "user": user_info}

@router.get("/auth/me", response_model=UserResponse)
@router.get("/v1/auth/me", response_model=UserResponse)
def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Return authenticated user profile and assigned role."""
    return user
