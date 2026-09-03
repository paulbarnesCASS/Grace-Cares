"""Authentication: JWT, password hashing, role-based access, seeding."""
import os
import secrets
import bcrypt
import jwt
from datetime import timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from bson import ObjectId

from core import db, now_utc, clean

JWT_ALGORITHM = "HS256"

ADMIN_ROLES = {
    "super_admin", "shop_admin", "finance_admin",
    "content_admin", "events_admin", "support_admin", "readonly",
    "product_contributor", "product_approver",
}
# roles allowed to see sensitive medical/support data
SENSITIVE_ROLES = {"super_admin", "finance_admin", "support_admin"}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user = clean(user)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


def require_admin(*allowed_roles):
    """Dependency factory. super_admin always allowed. Empty = any admin role."""
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role")
        if role == "super_admin":
            return user
        if role not in ADMIN_ROLES:
            raise HTTPException(403, "Admin access required")
        if allowed_roles and role not in allowed_roles:
            raise HTTPException(403, "You do not have permission for this action")
        return user
    return dep


auth_router = APIRouter(prefix="/api/auth")


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    password: str = Field(min_length=6)


async def _check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        if rec.get("locked_until") and rec["locked_until"] > now_utc():
            raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")


async def _record_fail(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    upd = {"count": count}
    if count >= 5:
        upd["locked_until"] = now_utc() + timedelta(minutes=15)
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": upd}, upsert=True)


@auth_router.post("/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    doc = {"email": email, "password_hash": hash_password(body.password),
           "name": body.name, "role": "customer", "addresses": [],
           "marketing_consent": False, "created_at": now_utc()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email, "customer"),
                     create_refresh_token(uid))
    doc = clean(doc); doc["id"] = uid; doc.pop("password_hash", None)
    return doc


@auth_router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "?"
    identifier = f"{ip}:{email}"
    await _check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await _record_fail(identifier)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email, user["role"]),
                     create_refresh_token(uid))
    user = clean(user); user.pop("password_hash", None)
    return user


@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@auth_router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        response.set_cookie("access_token",
                            create_access_token(str(user["_id"]), user["email"], user["role"]),
                            httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


@auth_router.post("/forgot-password")
async def forgot_password(body: ForgotBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": str(user["_id"]),
            "expires_at": now_utc() + timedelta(hours=1), "used": False})
        print(f"[PASSWORD RESET] {os.environ.get('FRONTEND_URL')}/reset-password?token={token}")
    return {"ok": True, "message": "If the account exists, a reset link has been sent."}


@auth_router.post("/reset-password")
async def reset_password(body: ResetBody):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used") or rec["expires_at"] < now_utc():
        raise HTTPException(400, "This reset link is invalid or has expired.")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])},
                              {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"email": email, "password_hash": hash_password(password),
                                   "name": "Grace Cares Admin", "role": "super_admin",
                                   "addresses": [], "marketing_consent": False,
                                   "created_at": now_utc()})
    else:
        upd = {"role": "super_admin"}
        if not verify_password(password, existing["password_hash"]):
            upd["password_hash"] = hash_password(password)
        await db.users.update_one({"email": email}, {"$set": upd})
