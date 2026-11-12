import { toast } from "sonner";
import { GiftCardsProvider } from "@/features/gift-cards";
import { http } from "@/lib/api";
import { useSite } from "@/lib/site";
import { uiLocale, useLang, useT } from "@/lib/i18n";
import { Logo } from "./Logo";
import { Consent } from "./FormBits";

export default function GiftCardsAdapter({ children }) {
  const site = useSite();
  const { td } = useT();
  useLang(); // Re-render date/currency formatting when the site's language changes.
  const gift = site?.content?.gifts || {};
  const offers = (site?.content?.pricing?.rates || []).map((r) => ({ nights: Number(r.nights), price: Number(String(r.price).replace(",", ".")) })).filter((r) => r.nights > 0 && r.price > 0);
  return <GiftCardsProvider config={{ api: http, notify: toast, offers, translate: td,
    checkoutEnabled: !!(gift.sales_enabled && gift.conditions_confirmed && Number(gift.validity_days) > 0),
    validityDays: Number(gift.validity_days) || 365,
    minAmount: Number(gift.min_amount) || 20, maxAmount: Number(gift.max_amount) || 2000,
    amounts: String(gift.amounts || "50,100,150,200").split(",").map(Number).filter((v) => v > 0),
    locale: uiLocale(), brandName: "La Cabane du Chêne", logo: <Logo light />,
    title: "Offrez une parenthèse à la cabane", description: "Un montant libre ou un crédit séjour, à utiliser dans le formulaire de réservation.",
    renderConsent: (props) => <Consent {...props} />,
  }}>{children}</GiftCardsProvider>;
}

