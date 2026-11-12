"""Project-independent gift-card settings. All monetary values are in major units."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlsplit


def cents(value) -> int:
    try:
        amount = Decimal(str(value))
        if not amount.is_finite():
            raise ValueError("Montant invalide")
        return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, TypeError, ValueError, OverflowError) as exc:
        raise ValueError("Montant invalide") from exc


@dataclass(frozen=True)
class GiftConfig:
    site_url: str
    brand_name: str = "Cartes cadeaux"
    currency: str = "eur"
    validity_days: int = 365
    min_amount: float = 20
    max_amount: float = 2000
    code_prefix: str = "CADEAU"
    base_guests: int = 2
    allowed_origins: tuple[str, ...] = ()
    success_path: str = "/carte-cadeau/merci"
    cancel_path: str = "/carte-cadeau"
    supported_languages: tuple[str, ...] = ("fr", "en", "nl", "de")

    def __post_init__(self):
        if self.validity_days < 1 or self.base_guests < 1 or not 0 < cents(self.min_amount) <= cents(self.max_amount):
            raise ValueError("Configuration des cartes cadeaux invalide")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("Devise invalide")
        self.origin(self.site_url)

    def origin(self, value: str) -> str:
        value = (value or "").rstrip("/")
        parts = urlsplit(value)
        if (parts.scheme not in ("https", "http") or not parts.netloc or parts.path
                or parts.query or parts.fragment or parts.username or parts.password
                or (parts.scheme == "http" and parts.hostname not in ("localhost", "127.0.0.1"))):
            raise ValueError("Adresse du site invalide")
        if value not in {self.site_url.rstrip("/"), *(x.rstrip("/") for x in self.allowed_origins)}:
            raise ValueError("Adresse du site non autorisée")
        return value

