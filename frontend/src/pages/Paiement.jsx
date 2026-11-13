import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { dfLocale } from "@/lib/i18n";
import { CheckCircle2, Loader2, Lock, AlertCircle } from "lucide-react";
import { http, errMsg } from "@/lib/api";
import { Eyebrow } from "@/components/site/Motion";

const euro = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} €`;
const day = (s) => { try { return format(parseISO(s), "EEEE d MMMM yyyy", { locale: dfLocale() }); } catch (e) { return s; } };

export default function Paiement() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const cancelled = params.get("annule");
  const [dep, setDep] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(!!sessionId);

  useEffect(() => {
    document.title = "Règlement de l'acompte — La Cabane du Chêne";
    http.get(`/deposits/${token}`).then((r) => { setDep(r.data); if (r.data?.status === "payee") setPaid(true); }).catch((e) => setError(errMsg(e, "Lien de paiement introuvable")));
  }, [token]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let tries = 0;
    let timer;
    const poll = async () => {
      try {
        const r = await http.get(`/payments/status/${sessionId}`);
        if (r.data?.payment_status === "paid") { setPaid(true); setChecking(false); return; }
        if (r.data?.status === "expired") { setChecking(false); return; }
      } catch (e) { /* retry */ }
      tries += 1;
      if (tries < 15) timer = setTimeout(poll, 2000); else setChecking(false);
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  const pay = async () => {
    setBusy(true);
    try {
      const r = await http.post(`/deposits/${token}/checkout`, { origin_url: window.location.origin });
      if (r.data?.checkout_url) window.location.href = r.data.checkout_url;
    } catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  return (
    <section data-testid="payment-page" className="min-h-[100svh] bg-canvas pt-32 pb-24">
      <div className="mx-auto max-w-xl px-5">
        <Eyebrow>Acompte en ligne</Eyebrow>
        <h1 className="mt-4 text-5xl font-medium leading-[1.02] text-ink">Votre séjour à la cabane</h1>
        {error && <p data-testid="payment-error" className="mt-8 flex gap-3 rounded-md bg-action/10 p-4 text-action-strong"><AlertCircle size={18} className="mt-0.5 shrink-0" /> {error}</p>}
        {!dep && !error && <Loader2 className="mt-10 animate-spin text-brand" />}
        {dep && (
          <div className="mt-10 rounded-md bg-white border border-brand/15 p-6 md:p-8 space-y-6">
            <div className="space-y-2 text-body">
              <p>Bonjour {dep.first_name},</p>
              <p>Arrivée : <strong className="text-ink">{day(dep.check_in)}</strong></p>
              <p>Départ : <strong className="text-ink">{day(dep.check_out)}</strong></p>
              <p>Voyageurs : {dep.guests}</p>
              {dep.total > 0 && <p>Montant total du séjour : {euro(dep.total)}</p>}
            </div>
            <div className="flex items-baseline justify-between border-t border-brand/15 pt-5">
              <span className="text-sm text-muted-ink">{dep.kind === "solde" ? "Solde à régler" : "Acompte à régler"}</span>
              <span data-testid="payment-amount" className="font-display text-4xl text-ink">{euro(dep.amount)}</span>
            </div>
            {paid ? (
              <div data-testid="payment-success" className="rounded-md bg-brand p-6 text-on-dark">
                <CheckCircle2 className="text-gold" size={30} />
                <p className="mt-3 font-display text-3xl">Paiement bien reçu, merci !</p>
                <p className="mt-2 text-sm text-[#D9DFDA]">Votre séjour est réservé. Un e-mail de confirmation vous a été envoyé.</p>
              </div>
            ) : checking ? (
              <p data-testid="payment-checking" className="flex items-center gap-3 text-sm text-muted-ink"><Loader2 size={16} className="animate-spin" /> Vérification du paiement…</p>
            ) : (
              <>
                {cancelled && <p className="text-sm text-action-strong">Le paiement a été annulé. Vous pouvez réessayer quand vous le souhaitez.</p>}
                {sessionId && <p className="text-sm text-action-strong">Le paiement n'a pas encore été confirmé. Si vous avez été débité, contactez-nous.</p>}
                <button onClick={pay} disabled={busy} data-testid="payment-pay-button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-4 font-semibold text-on-dark transition-colors hover:bg-action-strong disabled:opacity-60">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />} Payer {dep.kind === "solde" ? "le solde" : "l'acompte"} par carte
                </button>
                <p className="text-xs text-center text-muted-ink">Paiement sécurisé par Stripe. Vos coordonnées bancaires ne transitent pas par notre site.</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

