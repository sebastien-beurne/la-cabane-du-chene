"""Gift-card Stripe refunds, including legacy sessions without intent metadata."""
import asyncio

import stripe


async def refund_charge(db, charge):
    intent_id = charge.get("payment_intent")
    refunded = int(charge.get("amount_refunded") or 0)
    if not intent_id or refunded <= 0:
        return False
    card = await db.gift_cards.find_one({"stripe_payment_intent_id": intent_id})
    if not card:
        intent = await asyncio.to_thread(stripe.PaymentIntent.retrieve, intent_id)
        metadata = intent.get("metadata") or {}
        if metadata.get("type") == "carte_cadeau" and metadata.get("gift_id"):
            card = await db.gift_cards.find_one({"id": metadata["gift_id"]})
        else:
            sessions = await asyncio.to_thread(stripe.checkout.Session.list, payment_intent=intent_id, limit=1)
            if sessions.data:
                card = await db.gift_cards.find_one({"session_id": sessions.data[0].id})
    if not card:
        return False
    # Any full/partial refund freezes redemption. Partial refunds and cards already
    # spent need owner review; silently reviving a refunded card would create credit.
    await db.gift_cards.update_one(
        {"id": card["id"]},
        {"$set": {"status": "annulee", "balance": 0, "refund_received": True,
                  "refund_review_required": True, "stripe_payment_intent_id": intent_id},
         "$max": {"stripe_refunded_minor": refunded},
         "$addToSet": {"refunded_charge_ids": charge["id"]}})
    return True

