"""Isolated regression suite: never contacts the site, Stripe or an e-mail provider.

GIFT_TEST_MONGO_URL must point to a disposable local MongoDB replica set.
Only test-specific databases with random names are created/dropped.
"""
import asyncio
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from gift_cards import GiftConfig, consume, recredit, transact
from gift_cards.config import cents
from gift_cards.refunds import refund_charge
from gift_cards.router import build_router

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db():
    uri = os.environ.get("GIFT_TEST_MONGO_URL")
    if not uri:
        pytest.skip("Set GIFT_TEST_MONGO_URL to a disposable local MongoDB replica set")
    if not uri.startswith(("mongodb://127.0.0.1:", "mongodb://localhost:")):
        pytest.fail("Gift module tests only accept a local disposable MongoDB")
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client[f"test_gift_module_{uuid.uuid4().hex}"]
    await db.gift_cards.create_index("code", unique=True, partialFilterExpression={"code": {"$type": "string"}})
    try:
        yield db
    finally:
        await client.drop_database(db.name)
        client.close()


async def seed(db, **changes):
    card = {"id": uuid.uuid4().hex, "code": f"CADEAU-{uuid.uuid4().hex}", "type": "montant",
            "amount": 100, "balance": 100, "status": "active", "buyer_name": "Acheteur",
            "buyer_email": "buyer@example.com", "recipient_name": "Alice", "message": "Bonjour",
            "uses": [], "expires": (date.today() + timedelta(days=365)).isoformat(), **changes}
    await db.gift_cards.insert_one(dict(card))
    return card


async def save_booking(db, card, amount, bid, *, fail=False):
    async def save(session):
        pay = await consume(db, card, amount, bid, session=session)
        if fail:
            raise RuntimeError("simulated booking storage failure")
        await db.bookings.insert_one({"id": bid, "payments": [pay]}, session=session)
    await transact(db, save)


async def cancel_booking(db, bid):
    async def save(session):
        booking = await db.bookings.find_one({"id": bid}, session=session)
        lines = await recredit(db, booking, session=session)
        await db.bookings.update_one({"id": bid}, {"$push": {"payments": {"$each": lines}}}, session=session)
    await transact(db, save)


def harness(db, monkeypatch, *, mail_ok=True, config=None, authenticated=True):
    sent = []
    async def user():
        if not authenticated:
            raise HTTPException(401, "Authentification requise")
        return {"id": "owner"}
    async def price(nights):
        return {1: 175, 2: 305}.get(nights)
    async def bank():
        return {"holder": "Test", "iban": "TEST-IBAN", "bic": "TEST-BIC"}
    async def notify(event, card, label, site_url, **context):
        sent.append((event, card["id"]))
        return mail_ok
    router, fulfill = build_router(db, user, config=config or GiftConfig(site_url="https://example.com"),
                                   price_for_stay=price, get_bank=bank, notify=notify)
    app = FastAPI()
    app.include_router(router, prefix="/api")
    monkeypatch.setattr("stripe.checkout.Session.create", Mock(return_value=SimpleNamespace(id="cs_test", url="https://checkout.stripe.com/test")))
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://example.com/api/"), fulfill, sent


def order(**changes):
    return {"type": "montant", "amount": 100, "buyer_name": "Acheteur", "buyer_email": "buyer@example.com",
            "recipient_name": "Alice", "consent": True, "origin_url": "https://example.com", **changes}


@pytest.mark.parametrize("value,expected", [("0.1", 10), ("12.345", 1235), (0.1 + 0.2, 30)])
def test_money_rounds_to_cents(value, expected):
    assert cents(value) == expected


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", None, "abc"])
def test_non_finite_money_rejected(value):
    with pytest.raises(ValueError):
        cents(value)


def test_exact_origin_allowlist():
    config = GiftConfig(site_url="https://example.com", allowed_origins=("http://localhost:3000",))
    assert config.origin("https://example.com/") == "https://example.com"
    assert config.origin("http://localhost:3000") == "http://localhost:3000"
    for url in ["https://evil.example", "https://example.com.evil.example", "https://example.com/path", "https://user@example.com", "http://example.com"]:
        with pytest.raises(ValueError):
            config.origin(url)


async def test_booking_storage_failure_rolls_back_card(db):
    card = await seed(db)
    with pytest.raises(RuntimeError):
        await save_booking(db, card, 80, "failed", fail=True)
    stored = await db.gift_cards.find_one({"id": card["id"]})
    assert stored["balance"] == 100 and stored["uses"] == []
    assert await db.bookings.count_documents({}) == 0


async def test_concurrent_bookings_cannot_overspend(db):
    card = await seed(db)
    results = await asyncio.gather(save_booking(db, card, 80, "a"), save_booking(db, card, 80, "b"), return_exceptions=True)
    assert sum(r is None for r in results) == 1
    assert sum(isinstance(r, HTTPException) and r.status_code == 409 for r in results) == 1
    assert (await db.gift_cards.find_one({"id": card["id"]}))["balance"] == 20
    assert await db.bookings.count_documents({}) == 1


async def test_fractional_amounts_keep_exact_cent_balance(db):
    card = await seed(db, amount=0.3, balance=0.3)
    await save_booking(db, card, 0.1, "a")
    await save_booking(db, card, 0.2, "b")
    assert (await db.gift_cards.find_one({"id": card["id"]}))["balance"] == 0


async def test_expired_card_is_checked_at_debit(db):
    card = await seed(db, expires=(date.today() - timedelta(days=1)).isoformat())
    with pytest.raises(HTTPException):
        await save_booking(db, card, 20, "a")
    assert (await db.gift_cards.find_one({"id": card["id"]}))["balance"] == 100


async def test_concurrent_and_repeated_recredits_only_apply_once(db):
    card = await seed(db)
    await save_booking(db, card, 100, "a")
    await asyncio.gather(cancel_booking(db, "a"), cancel_booking(db, "a"))
    await cancel_booking(db, "a")
    stored = await db.gift_cards.find_one({"id": card["id"]})
    assert stored["balance"] == 100 and len(stored["recredits"]) == 1
    booking = await db.bookings.find_one({"id": "a"})
    assert sum(p["amount"] for p in booking["payments"]) == 0


async def test_recredit_failure_rolls_back_ledger_and_card(db):
    card = await seed(db)
    await save_booking(db, card, 80, "a")
    async def fail(session):
        booking = await db.bookings.find_one({"id": "a"}, session=session)
        await recredit(db, booking, session=session)
        raise RuntimeError("simulated cancellation storage failure")
    with pytest.raises(RuntimeError):
        await transact(db, fail)
    assert (await db.gift_cards.find_one({"id": card["id"]}))["balance"] == 20
    await cancel_booking(db, "a")
    assert (await db.gift_cards.find_one({"id": card["id"]}))["balance"] == 100


async def test_transfer_activation_and_mail_failure(db, monkeypatch):
    client, _, sent = harness(db, monkeypatch, mail_ok=False)
    async with client:
        response = await client.post("gift-cards/checkout", json=order(method="virement"))
        assert response.status_code == 200
        card = await db.gift_cards.find_one({"transfer_ref": response.json()["transfer"]["ref"]})
        assert card["code"] is None and card["status"] == "virement_attendu"
        results = await asyncio.gather(*[client.post(f"admin/gift-cards/{card['id']}/transfer-received") for _ in range(2)])
        assert sum(r.status_code == 200 for r in results) == 1
        activated = next(r.json() for r in results if r.status_code == 200)
        assert activated["status"] == "active" and activated["email_sent"] is False
        assert sum(e == "card" for e, _ in sent) == 1


@pytest.mark.parametrize("changes,status", [({"amount": 19}, 400), ({"amount": 2001}, 400), ({"consent": False}, 400),
    ({"origin_url": "https://evil.example"}, 400), ({"method": "unknown"}, 422)])
async def test_checkout_rejects_invalid_orders(db, monkeypatch, changes, status):
    client, _, _ = harness(db, monkeypatch)
    async with client:
        assert (await client.post("gift-cards/checkout", json=order(**changes))).status_code == status
    assert await db.gift_cards.count_documents({}) == 0


async def test_stay_price_is_derived_from_host_not_browser(db, monkeypatch):
    client, _, _ = harness(db, monkeypatch)
    async with client:
        response = await client.post("gift-cards/checkout", json=order(type="sejour", nights=2, amount=1, method="virement"))
    assert response.status_code == 200 and response.json()["transfer"]["amount"] == 305


async def test_paid_session_is_verified_and_activation_idempotent(db, monkeypatch):
    client, fulfill, sent = harness(db, monkeypatch, mail_ok=False)
    async with client:
        assert (await client.post("gift-cards/checkout", json=order())).status_code == 200
        card = await db.gift_cards.find_one({"session_id": "cs_test"})
        session = SimpleNamespace(payment_status="paid", currency="eur", amount_subtotal=10000,
                                  metadata={"gift_id": card["id"]}, payment_intent="pi_test")
        monkeypatch.setattr("stripe.checkout.Session.retrieve", lambda sid: session)
        await asyncio.gather(fulfill("cs_test"), fulfill("cs_test"))
        response = await client.get("gift-cards/status/cs_test")
    assert response.json()["status"] == "active" and response.json()["email_sent"] is False
    assert "buyer_email" not in response.json() and "session_id" not in response.json()
    assert sum(e == "card" for e, _ in sent) == 1


@pytest.mark.parametrize("currency,total", [("usd", 10000), ("eur", 1)])
async def test_mismatched_paid_session_does_not_activate(db, monkeypatch, currency, total):
    client, fulfill, _ = harness(db, monkeypatch)
    async with client:
        await client.post("gift-cards/checkout", json=order())
    card = await db.gift_cards.find_one({"session_id": "cs_test"})
    session = SimpleNamespace(payment_status="paid", currency=currency, amount_subtotal=total,
                              metadata={"gift_id": card["id"]}, payment_intent="pi_test")
    monkeypatch.setattr("stripe.checkout.Session.retrieve", lambda sid: session)
    with pytest.raises(HTTPException):
        await fulfill("cs_test")
    assert (await db.gift_cards.find_one({"id": card["id"]}))["status"] == "en_attente"


@pytest.mark.parametrize("refunded", [5000, 10000])
async def test_stripe_refund_freezes_card_and_cannot_be_undone(db, monkeypatch, refunded):
    card = await seed(db, stripe_payment_intent_id="pi_test")
    charge = {"id": "ch_test", "payment_intent": "pi_test", "amount_refunded": refunded}
    assert await refund_charge(db, charge)
    assert await refund_charge(db, charge)
    stored = await db.gift_cards.find_one({"id": card["id"]})
    assert stored["balance"] == 0 and stored["status"] == "annulee"
    assert stored["stripe_refunded_minor"] == refunded and stored["refunded_charge_ids"] == ["ch_test"]
    client, _, _ = harness(db, monkeypatch)
    async with client:
        assert (await client.patch(f"admin/gift-cards/{card['id']}", json={"status": "active"})).status_code == 404
    with pytest.raises(HTTPException):
        await save_booking(db, card, 10, "a")


async def test_refund_before_activation_blocks_later_fulfillment(db, monkeypatch):
    client, fulfill, sent = harness(db, monkeypatch)
    async with client:
        await client.post("gift-cards/checkout", json=order())
    card = await db.gift_cards.find_one({"session_id": "cs_test"})
    monkeypatch.setattr("stripe.PaymentIntent.retrieve", lambda sid: {"metadata": {"type": "carte_cadeau", "gift_id": card["id"]}})
    assert await refund_charge(db, {"id": "ch_test", "payment_intent": "pi_test", "amount_refunded": 10000})
    await fulfill("cs_test")
    stored = await db.gift_cards.find_one({"id": card["id"]})
    assert stored["code"] is None and stored["status"] == "annulee"
    assert not sent


async def test_paid_card_cannot_be_deleted(db, monkeypatch):
    card = await seed(db)
    client, _, _ = harness(db, monkeypatch)
    async with client:
        assert (await client.delete(f"admin/gift-cards/{card['id']}")).status_code == 409
    assert await db.gift_cards.count_documents({"id": card["id"]}) == 1


async def test_configuration_is_reusable_for_another_brand(db, monkeypatch):
    config = GiftConfig(site_url="https://example.com", brand_name="Autre projet", currency="usd", validity_days=30,
                        code_prefix="GIFT", min_amount=5, max_amount=500)
    client, _, _ = harness(db, monkeypatch, config=config)
    async with client:
        response = await client.post("admin/gift-cards", json={"type": "montant", "amount": 5, "recipient_name": "Bob"})
    card = response.json()
    assert response.status_code == 200 and card["code"].startswith("GIFT-")
    assert card["currency"] == "usd" and card["expires"] == (date.today() + timedelta(days=30)).isoformat()


async def test_admin_endpoints_still_require_authentication(db, monkeypatch):
    client, _, _ = harness(db, monkeypatch, authenticated=False)
    async with client:
        assert (await client.get("admin/gift-cards")).status_code == 401
        assert (await client.post("admin/gift-cards", json={"amount": 50, "recipient_name": "Alice"})).status_code == 401
    assert await db.gift_cards.count_documents({}) == 0


async def test_module_exposes_its_own_payment_options(db, monkeypatch):
    client, _, _ = harness(db, monkeypatch)
    async with client:
        response = await client.get("gift-cards/payment-options")
    assert response.json() == {"card": True, "transfer": True}


async def test_legacy_refund_without_intent_metadata_is_resolved_by_session(db, monkeypatch):
    card = await seed(db, session_id="cs_legacy")
    monkeypatch.setattr("stripe.PaymentIntent.retrieve", lambda sid: {"metadata": {}})
    monkeypatch.setattr("stripe.checkout.Session.list", lambda **kw: SimpleNamespace(data=[SimpleNamespace(id="cs_legacy")]))
    assert await refund_charge(db, {"id": "ch_legacy", "payment_intent": "pi_legacy", "amount_refunded": 10000})
    assert (await db.gift_cards.find_one({"id": card["id"]}))["status"] == "annulee"


async def test_transaction_unavailable_fails_before_callback():
    from pymongo.errors import ConfigurationError
    class Client:
        async def start_session(self):
            raise ConfigurationError("sessions unsupported")
    called = False
    async def save(session):
        nonlocal called
        called = True
    with pytest.raises(HTTPException) as error:
        await transact(SimpleNamespace(client=Client()), save)
    assert error.value.status_code == 503 and not called


async def test_pending_checkout_is_expired_before_deleting_order(db, monkeypatch):
    card = await seed(db, code=None, status="en_attente", session_id="cs_pending")
    expire = Mock(return_value=SimpleNamespace(payment_status="unpaid", status="expired"))
    monkeypatch.setattr("stripe.checkout.Session.expire", expire)
    client, _, _ = harness(db, monkeypatch)
    async with client:
        assert (await client.delete(f"admin/gift-cards/{card['id']}")).status_code == 200
    expire.assert_called_once_with("cs_pending")
    assert await db.gift_cards.count_documents({"id": card["id"]}) == 0


async def test_manual_resend_updates_delivery_confirmation(db, monkeypatch):
    card = await seed(db, email_sent=False)
    client, _, _ = harness(db, monkeypatch, mail_ok=True)
    async with client:
        response = await client.post(f"admin/gift-cards/{card['id']}/resend")
    assert response.json() == {"ok": True}
    assert (await db.gift_cards.find_one({"id": card["id"]}))["email_sent"] is True
