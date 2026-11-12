import { createContext, useContext } from "react";

const Context = createContext(null);

function rgb(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Les couleurs du module doivent être au format #RRGGBB.");
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
}

export const giftDefaults = {
  brandName: "Cartes cadeaux", title: "Offrez une carte cadeau",
  description: "Un montant libre ou un crédit cadeau correspondant à une offre.",
  amounts: [50, 100, 150, 200], minAmount: 20, maxAmount: 2000,
  validityDays: 365, currency: "EUR", locale: "fr-FR", offers: [],
  baseGuests: 2, checkoutEnabled: true,
  primary: "#2D4A3E", ink: "#1B2B24", accent: "#B35432", privacyUrl: "/confidentialite",
};

export function GiftCardsProvider({ config, children }) {
  const value = { ...giftDefaults, ...config };
  if (!value.api) throw new Error("GiftCardsProvider nécessite un adaptateur api (get, post, patch, delete).");
  value.money = (amount) => new Intl.NumberFormat(value.locale, {
    style: "currency", currency: value.currency,
  }).format(Number(amount || 0));
  value.day = (input) => {
    if (!input) return "—";
    const date = new Date(`${String(input).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? input : new Intl.DateTimeFormat(value.locale, {
      day: "numeric", month: "long", year: "numeric",
    }).format(date);
  };
  value.text = (source, params = {}) => {
    const translated = value.translate ? value.translate(source) : source;
    return translated.replace(/\{(\w+)\}/g, (whole, key) => params[key] ?? whole);
  };
  value.notify = value.notify || { success() {}, error() {} };
  return <Context.Provider value={value}>
    <div className="gift-cards" style={{ "--gift-primary-rgb": rgb(value.primary), "--gift-ink-rgb": rgb(value.ink), "--gift-accent-rgb": rgb(value.accent) }}>
      {children}
    </div>
  </Context.Provider>;
}

export function useGiftCards() {
  const context = useContext(Context);
  if (!context) throw new Error("Composant à placer dans GiftCardsProvider.");
  return context;
}

export function errMsg(error, fallback = "Une erreur est survenue. Merci de réessayer.") {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

