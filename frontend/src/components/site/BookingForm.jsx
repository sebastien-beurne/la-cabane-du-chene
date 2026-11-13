import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { useT } from "@/lib/i18n";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { http, errMsg } from "@/lib/api";
import { useSite } from "@/lib/site";
import { Field, inputCls, Honeypot, Consent } from "./FormBits";
import PaymentChoice from "./PaymentChoice";
import QuoteSummary, { Stepper, eur } from "./QuoteSummary";

const iso = (d) => format(d, "yyyy-MM-dd");
const REQUIRED = ["first_name", "last_name", "email", "phone", "street", "postal_code", "city", "country"];

function useMonths() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setN(mq.matches ? 2 : 1);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return n;
}

export default function BookingForm() {
  const { t, td, fmtDate, dateLocale } = useT();
  const site = useSite();
  const pricing = site?.content?.pricing || {};
  const options = (pricing.options || []).filter((o) => o?.active && o?.label);
  const rates = (pricing.rates || []).map((r) => Number(r.nights)).filter((n) => n > 0);
  const maxNights = rates.length ? Math.max(...rates) : 4;
  const maxGuests = Number(pricing.max_guests) || 4;
  const bfPrice = Number(String(pricing.breakfast_price || "").replace(",", ".")) || 0;
  const [blocked, setBlocked] = useState([]);
  const [avail, setAvail] = useState("loading");
  const [range, setRange] = useState();
  const [form, setForm] = useState({ guests: 2, first_name: "", last_name: "", email: "", phone: "", street: "", postal_code: "", city: "", country: "", message: "", options: [], consent: false, website: "", breakfasts: 0, promo_code: "", payment_method: "" });
  const [withBf, setWithBf] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [qs, setQs] = useState({ key: "", data: null, loading: false, error: "" });
  const quoteReq = useRef({ id: 0, ctrl: null });
  const [quoteTry, setQuoteTry] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const started = useRef(Date.now());
  const months = useMonths();

  const loadAvail = useCallback(() => {
    setAvail("loading");
    const ctrl = new AbortController();
    http.get("/availability", { signal: ctrl.signal, timeout: 20000 })
      .then((r) => {
        if (!Array.isArray(r.data?.blocked)) throw new Error("bad payload");
        setBlocked(r.data.blocked);
        setAvail("ok");
      })
      .catch((e) => { if (!ctrl.signal.aborted) setAvail("error"); });
    return ctrl;
  }, []);

  useEffect(() => {
    const ctrl = loadAvail();
    return () => ctrl.abort();
  }, [loadAvail]);

  const calLabels = { labelPrevious: () => t("cal.prev"), labelNext: () => t("cal.next") };
  const nights = useMemo(() => blocked.map((b) => ({ from: parseISO(b.start), to: subDays(parseISO(b.end), 1) })), [blocked]);
  const today = new Date();

  const onSelect = (r) => {
    if (avail !== "ok") return;
    if (r?.from && r?.to) {
      const a = iso(r.from), b = iso(r.to);
      if (blocked.some((x) => a < x.end && x.start < b)) {
        toast.error(t("bk.unavailableRange"));
        setRange({ from: r.to, to: undefined });
        return;
      }
      if (differenceInCalendarDays(r.to, r.from) > maxNights) {
        toast.error(t("bk.maxNights", { n: maxNights }));
        setRange({ from: r.from, to: undefined });
        return;
      }
    }
    setRange(r);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setPayMethod = useCallback((v) => setForm((f) => ({ ...f, payment_method: v })), []);
  const toggleOpt = (label) => setForm((f) => ({ ...f, options: f.options.includes(label) ? f.options.filter((o) => o !== label) : [...f.options, label] }));
  const n = range?.from && range?.to ? differenceInCalendarDays(range.to, range.from) : 0;
  const breakfasts = withBf ? form.breakfasts : 0;

  const quoteBody = n ? { check_in: iso(range.from), check_out: iso(range.to), guests: Number(form.guests), breakfasts, options: form.options, promo_code: form.promo_code } : null;
  const selKey = quoteBody ? JSON.stringify(quoteBody) : "";
  const quote = qs.data && qs.key === selKey ? qs.data : null;
  const quoteStale = !!qs.data && qs.key !== selKey;
  const quoteBusy = !!selKey && !qs.error && (qs.loading || qs.key !== selKey);

  useEffect(() => {
    quoteReq.current.ctrl?.abort();
    if (!selKey) { setQs({ key: "", data: null, loading: false, error: "" }); return undefined; }
    const id = ++quoteReq.current.id;
    setQs((s) => ({ ...s, loading: true, error: "" }));
    const t = setTimeout(() => {
      const ctrl = new AbortController();
      quoteReq.current.ctrl = ctrl;
      http.post("/quote", JSON.parse(selKey), { signal: ctrl.signal, timeout: 20000 })
        .then((r) => { if (id === quoteReq.current.id) setQs({ key: selKey, data: r.data, loading: false, error: "" }); })
        .catch((e) => {
          if (ctrl.signal.aborted || id !== quoteReq.current.id) return;
          // Kept as a server text or a stable key, translated at render time (follows language changes).
          const msg = e?.response ? { text: errMsg(e, ""), key: "err.generic" } : { key: "bk.quoteNetErr" };
          setQs((s) => ({ ...s, loading: false, error: msg }));
        });
    }, 250);
    return () => clearTimeout(t);
  }, [selKey, quoteTry]);

  useEffect(() => () => quoteReq.current.ctrl?.abort(), []);

  const submit = async (e) => {
    e.preventDefault();
    if (!n) return toast.error(t("bk.pickDates"));
    if (qs.error) return toast.error(quoteErr);
    if (!quote || quoteBusy) return toast.error(t("bk.wait"));
    const missing = REQUIRED.filter((k) => !String(form[k] || "").trim()).map((k) => t(`fld.${k}`));
    if (missing.length) return toast.error(t("bk.missing", { list: missing.join(", ") }));
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast.error(t("bk.badEmail"));
    if (form.phone.replace(/\D/g, "").length < 6) return toast.error(t("bk.badPhone"));
    if (!form.payment_method) return toast.error(t("bk.payReq"));
    if (!form.consent) return toast.error(t("form.consentReq"));
    setSending(true);
    try {
      await http.post("/booking-requests", {
        ...JSON.parse(selKey), ...form, breakfasts, guests: Number(form.guests), check_in: iso(range.from), check_out: iso(range.to), elapsed_ms: Date.now() - started.current,
      });
      setDone({ from: range.from, to: range.to });
    } catch (err) {
      toast.error(td(errMsg(err, t("err.generic"))));
    } finally {
      setSending(false);
    }
  };
  const quoteErr = qs.error ? (qs.error.text ? td(qs.error.text) : t(qs.error.key)) : "";

  if (done) {
    return (
      <div data-testid="booking-success" data-no-translate className="rounded-md bg-brand p-8 md:p-10 text-on-dark">
        <CheckCircle2 size={36} className="text-gold" />
        <h3 className="mt-5 text-3xl md:text-4xl font-medium">{t("bk.sentTitle")}</h3>
        <p className="mt-4 leading-relaxed text-[#D9DFDA]">
          {t("bk.sentDates", { from: fmtDate(done.from, "full"), to: fmtDate(done.to, "full") })}
        </p>
        <p className="mt-4 rounded-md bg-white/10 p-4 text-sm leading-relaxed">
          {t("bk.notYet")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="booking-form" data-no-translate className="space-y-7" noValidate>
      <div className="relative rounded-md border border-brand/15 bg-white p-3 md:p-5" aria-busy={avail === "loading"} aria-label={t("cal.label")} role="group">
        <div>
        <Calendar
          mode="range"
          locale={dateLocale}
          labels={calLabels}
          numberOfMonths={months}
          selected={range}
          onSelect={onSelect}
          disabled={avail === "ok" ? [{ before: addDays(today, 0) }, ...nights] : true}
          modifiers={{ booked: nights }}
          modifiersClassNames={{ booked: "line-through text-action/60" }}
          className={`mx-auto transition-opacity duration-200 ${avail === "ok" ? "" : "opacity-40"}`}
          data-testid="availability-calendar"
        />
        </div>
        {avail !== "ok" && (
          <div className="absolute inset-0 grid place-items-center p-4" data-testid={`availability-${avail}`}>
            {avail === "loading" ? (
              <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow"><Loader2 size={16} className="animate-spin" /> {t("bk.loadingAvail")}</p>
            ) : (
              <div className="max-w-xs rounded-md bg-white p-4 text-center text-sm text-body shadow">
                <p>{t("bk.availErr")}</p>
                <button type="button" onClick={loadAvail} className="mt-3 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white" data-testid="availability-retry">{t("retry")}</button>
              </div>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-2 text-xs text-muted-ink">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-brand" /> {t("bk.legendSel")}</span>
          <span className="flex items-center gap-2"><span className="text-action line-through">12</span> {t("bk.legendOff")}</span>
        </div>
      </div>
      <div data-testid="booking-selected-dates" className="flex items-start gap-3 rounded-md bg-sand p-4 text-sm text-body">
        <Info size={18} className="mt-0.5 shrink-0 text-action" />
        {n ? (
          <span>{t("bk.selected", { from: fmtDate(range.from), to: fmtDate(range.to), n })}</span>
        ) : (
          <span>{t("bk.hint")}</span>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-ink">{t("bk.guests")}</span>
          <Stepper value={Number(form.guests)} min={1} max={maxGuests} onChange={(v) => setForm((f) => ({ ...f, guests: v }))} testid="booking-form-guests" label={t("bk.guests")} />
          <span className="block text-xs text-muted-ink">{t("bk.upTo", { n: maxGuests })}</span>
        </div>
        {bfPrice > 0 && (
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-ink">
              <Checkbox checked={withBf} onCheckedChange={(v) => { setWithBf(!!v); if (v && !form.breakfasts) setForm((f) => ({ ...f, breakfasts: Number(f.guests) })); }} data-testid="booking-breakfast-toggle" />
              {t("bk.breakfast", { price: eur(bfPrice) })}
            </label>
            {withBf && (
              <div className="flex items-center gap-3">
                <Stepper value={form.breakfasts} min={1} max={Math.max(1, Number(form.guests) * Math.max(n, 1))} onChange={(v) => setForm((f) => ({ ...f, breakfasts: v }))} testid="booking-breakfasts" label={t("bk.breakfastCount")} />
                <span className="text-sm text-body" data-testid="booking-breakfast-total">= {eur(form.breakfasts * bfPrice)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2" data-testid="booking-contact-fields">
        <Field label={t("bk.firstName")} htmlFor="b-first">
          <input id="b-first" required autoComplete="given-name" value={form.first_name} onChange={set("first_name")} className={inputCls} data-testid="booking-form-first-name" />
        </Field>
        <Field label={t("bk.lastName")} htmlFor="b-last">
          <input id="b-last" required autoComplete="family-name" value={form.last_name} onChange={set("last_name")} className={inputCls} data-testid="booking-form-last-name" />
        </Field>
        <Field label={t("bk.email")} htmlFor="b-email">
          <input id="b-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} className={inputCls} data-testid="booking-form-email" />
        </Field>
        <Field label={t("bk.phone")} htmlFor="b-phone">
          <input id="b-phone" type="tel" required autoComplete="tel" value={form.phone} onChange={set("phone")} className={inputCls} data-testid="booking-form-phone" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("bk.street")} htmlFor="b-street">
            <input id="b-street" required autoComplete="street-address" value={form.street} onChange={set("street")} className={inputCls} data-testid="booking-form-street" />
          </Field>
        </div>
        <Field label={t("bk.zip")} htmlFor="b-zip">
          <input id="b-zip" required autoComplete="postal-code" value={form.postal_code} onChange={set("postal_code")} className={inputCls} data-testid="booking-form-postal-code" />
        </Field>
        <Field label={t("bk.city")} htmlFor="b-city">
          <input id="b-city" required autoComplete="address-level2" value={form.city} onChange={set("city")} className={inputCls} data-testid="booking-form-city" />
        </Field>
        <Field label={t("bk.country")} htmlFor="b-country">
          <input id="b-country" required autoComplete="country-name" value={form.country} onChange={set("country")} className={inputCls} data-testid="booking-form-country" />
        </Field>
      </div>
      {options.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-semibold text-ink">{t("bk.options")}</legend>
          {options.map((o, i) => (
            <label key={o.label} className="flex items-start gap-3 text-sm text-body">
              <Checkbox checked={form.options.includes(o.label)} onCheckedChange={() => toggleOpt(o.label)} data-testid={`booking-option-${i}`} className="mt-0.5" />
              <span>{td(o.label)}{o.price ? ` — ${td(o.price)}` : ""}{o.note ? <span className="block text-xs text-muted-ink">{td(o.note)}</span> : null}</span>
            </label>
          ))}
        </fieldset>
      )}
      <Field label={t("bk.message")} htmlFor="b-msg">
        <textarea id="b-msg" rows={4} maxLength={2000} value={form.message} onChange={set("message")} className={inputCls} data-testid="booking-form-message" placeholder={t("bk.messagePh")} />
      </Field>
      <Honeypot value={form.website} onChange={set("website")} />
      <div className="space-y-2">
        <label htmlFor="b-promo" className="block text-sm font-semibold text-ink">{t("bk.promo")}</label>
        <div className="flex gap-2">
          <input id="b-promo" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} className={inputCls} data-testid="booking-promo-input" placeholder="CODE" />
          <button type="button" onClick={() => setForm((f) => ({ ...f, promo_code: promoInput.trim() }))} data-testid="booking-promo-apply" className="shrink-0 rounded-md border border-brand/30 px-4 text-sm font-semibold text-ink hover:bg-sand">{t("bk.apply")}</button>
        </div>
      </div>
      <QuoteSummary q={quote || (quoteStale ? qs.data : null)} method={form.payment_method} stale={!quote && quoteStale} loading={quoteBusy}
        error={n > 0 ? quoteErr : ""} onRetry={() => setQuoteTry((v) => v + 1)} />
      <PaymentChoice value={form.payment_method} onChange={setPayMethod} quote={quote} />
      <Consent checked={form.consent} onChange={(v) => setForm((f) => ({ ...f, consent: v }))} testid="booking-form-consent" />
      <button type="submit" disabled={sending || quoteBusy} data-testid="booking-form-submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-4 font-semibold text-on-dark transition-colors hover:bg-action-strong disabled:opacity-60">
        {(sending || quoteBusy) && <Loader2 size={18} className="animate-spin" />} {quoteBusy ? t("bk.calculating") : t("bk.submit")}
      </button>
      <p className="text-xs text-center text-muted-ink">{t("bk.noPay")}</p>
    </form>
  );
}

