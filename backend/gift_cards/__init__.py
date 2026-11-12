"""Reusable gift-card backend. Host integrations are injected into build_router."""
from .config import GiftConfig
from .ledger import consume, find_gift, recredit, state, transact
from .router import build_router

__all__ = ["GiftConfig", "build_router", "consume", "find_gift", "recredit", "state", "transact"]

