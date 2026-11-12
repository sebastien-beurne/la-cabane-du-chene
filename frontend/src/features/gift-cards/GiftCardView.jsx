import { useGiftCards } from "./context";

export default function GiftCardView({ g }) {
  const { money: eur, day, logo, brandName, text: tr } = useGiftCards();
  const value = g.type === "sejour" ? tr("Crédit séjour : {amount}", { amount: eur(g.amount) }) : eur(g.amount);
  return (
    <div data-no-translate data-testid="gift-card-view" className="gift-print relative overflow-hidden rounded-md bg-[rgb(var(--gift-ink-rgb))] p-7 md:p-10 text-[#F8F5F0]">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[#E3B48A]/30" aria-hidden />
      <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full border border-[#E3B48A]/20" aria-hidden />
      {logo || <strong className="text-2xl">{brandName}</strong>}
      <p className="mt-8 text-xs uppercase tracking-[0.28em] text-[#E3B48A]">{tr("Carte cadeau")}</p>
      <p className="mt-2 font-display text-4xl md:text-5xl" data-testid="gift-card-value">{value}</p>
      {g.type === "sejour" && <p className="mt-2 text-sm">{tr("Valeur correspondant à {nights} nuit(s) au tarif d’achat. Complément éventuel selon le tarif à la réservation.", { nights: g.nights })}</p>}
      <p className="mt-3 text-[#D9DFDA]">{tr("Pour")} <strong className="text-white">{g.recipient_name}</strong>{g.buyer_name ? <> · {tr("de la part de")} {g.buyer_name}</> : null}</p>
      {g.message && <p className="mt-5 max-w-lg whitespace-pre-line font-display text-xl italic text-[#ECE7DE]">« {g.message} »</p>}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-5">
        <div>
          <p className="text-xs text-[#C3CCC6]">{tr("Code à saisir lors de la réservation")}</p>
          <p className="mt-1 font-mono text-2xl tracking-[0.15em] text-[#E3B48A]" data-testid="gift-card-code">{g.code}</p>
        </div>
        {g.expires && <p className="text-sm text-[#C3CCC6]">{tr("Valable jusqu’au {date}", { date: day(g.expires) })}</p>}
      </div>
    </div>
  );
}


