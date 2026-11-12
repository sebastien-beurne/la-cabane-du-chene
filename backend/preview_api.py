"""Disposable UI review fixture. Production must run server:app.

Only the explicit local preview launcher uses this module. It exposes a demo
administrator against an empty in-memory database; it never opens a real DB.
"""
import os

if os.environ.get("APP_ENV") != "preview" or os.environ.get("PREVIEW_MEMORY_DB") != "true":
    raise RuntimeError("The demo API requires the disposable preview database")

from server import app, db, current_user


async def demo_owner():
    user = await db.users.find_one({}, {"password_hash": 0})
    return {"id": str(user["_id"]), "email": user["email"],
            "name": "Propriétaire — démonstration", "role": "admin"}


app.dependency_overrides[current_user] = demo_owner
