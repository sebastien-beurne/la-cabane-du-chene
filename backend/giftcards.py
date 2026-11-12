"""La Cabane du Chêne adapter. The reusable backend lives in gift_cards/."""
from gift_cards.refunds import refund_charge
import emailer
from bookings import find_promo, rate_table
from gift_cards import GiftConfig, consume, find_gift, recredit, state, transact
from gift_cards.router import build_router as build_gift_router


async def resolve_code(db, code):
    if not code or not code.strip():
        return None, None
    code = code.strip().upper()
    if await db.promo_codes.find_one({"code": code}):
        return await find_promo(db, code), None
    return None, await find_gift(db, code)


def build_router(db, current_user, get_content, check_origin, site_url, owner_email):
    # The generic checkout validates exact origins. Additional preview origins are explicit.
    import os
    config = GiftConfig(site_url=site_url, brand_name="La Cabane du Chêne",
                        allowed_origins=tuple(x.strip() for x in os.environ.get("CORS_ORIGINS", "").split(",") if x.strip()))

    async def price_for_stay(nights):
        return rate_table((await get_content()).get("pricing") or {}).get(nights)

    async def get_bank():
        return ((await db.settings.find_one({"key": "bank"})) or {}).get("data") or {}

    async def notify(event, card, label, origin, **context):
        builders = {
            "card": lambda: emailer.gift_card_email(card, label, origin),
            "purchased": lambda: emailer.gift_owner_email(card, label),
            "transfer": lambda: emailer.gift_transfer_email(card, label, context["bank"]),
            "transfer_requested": lambda: emailer.gift_transfer_owner_email(card, label),
        }
        subject, html = builders[event]()
        owner = event in ("purchased", "transfer_requested")
        return await emailer.send_email(
            to=owner_email if owner else card.get("buyer_email"), subject=subject, html=html,
            lang="fr" if owner else card.get("lang", "fr"), kind=context.get("kind", "automatique"),
            category="carte_cadeau_proprietaire" if owner else "carte_cadeau",
            ref=emailer.gref(card))

    async def can_sell():
        gift = (await get_content()).get("gifts") or {}
        try:
            valid = int(gift.get("validity_days") or 0) > 0
        except (TypeError, ValueError):
            valid = False
        return bool(gift.get("sales_enabled") and gift.get("conditions_confirmed")
                    and valid
                    and os.environ.get("STRIPE_SECRET_KEY") and os.environ.get("EMERGENT_EMAIL_KEY"))

    async def policy_provider():
        return (await get_content()).get("gifts") or {}

    return build_gift_router(db, current_user, config=config, price_for_stay=price_for_stay,
                             get_bank=get_bank, notify=notify, can_sell=can_sell, policy_provider=policy_provider)

