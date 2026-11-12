import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _token(payload: dict, delta: timedelta) -> str:
    payload = {**payload, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def create_access_token(user_id: str, email: str) -> str:
    return _token({"sub": user_id, "email": email, "type": "access"}, timedelta(minutes=15))


def create_refresh_token(user_id: str) -> str:
    return _token({"sub": user_id, "type": "refresh"}, timedelta(days=30))


def decode(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Session invalide")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Session invalide")
    return payload


def set_auth_cookies(response, access: str, refresh: str | None = None):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    if refresh:
        response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=2592000, path="/")


def make_current_user(db):
    async def get_current_user(request: Request) -> dict:
        token = request.cookies.get("access_token")
        auth = request.headers.get("Authorization", "")
        if not token and auth.startswith("Bearer "):
            token = auth[7:]
        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié")
        payload = decode(token, "access")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])}, {"password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name"), "role": user.get("role")}
    return get_current_user

