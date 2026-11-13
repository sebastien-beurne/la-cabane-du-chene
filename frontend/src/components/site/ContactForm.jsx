import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Field, inputCls, Honeypot, Consent } from "./FormBits";

export default function ContactForm({ initialSubject = "", initialMessage = "" }) {
  const { t, td } = useT();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: initialSubject, message: initialMessage, consent: false, website: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || form.message.trim().length < 5) return toast.error(t("ct.required"));
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast.error(t("bk.badEmail"));
    if (!form.consent) return toast.error(t("form.consentReq"));
    setSending(true);
    try {
      await http.post("/contact", { ...form, elapsed_ms: Date.now() - started.current });
      setDone(true);
    } catch (err) {
      toast.error(td(errMsg(err, t("err.generic"))));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div data-testid="contact-success" data-no-translate className="rounded-md bg-brand p-8 text-on-dark">
        <CheckCircle2 size={32} className="text-gold" />
        <h3 className="mt-4 text-3xl font-medium">{t("ct.sentTitle")}</h3>
        <p className="mt-3 text-[#D9DFDA]">{t("ct.sentText")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="contact-form" data-no-translate className="relative space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("ct.name")} htmlFor="c-name"><input id="c-name" autoComplete="name" value={form.name} onChange={set("name")} className={inputCls} data-testid="contact-form-name" /></Field>
        <Field label={t("ct.email")} htmlFor="c-email"><input id="c-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} className={inputCls} data-testid="contact-form-email" /></Field>
        <Field label={t("ct.phone")} htmlFor="c-phone"><input id="c-phone" type="tel" value={form.phone} onChange={set("phone")} className={inputCls} data-testid="contact-form-phone" /></Field>
        <Field label={t("ct.subject")} htmlFor="c-subject"><input id="c-subject" value={form.subject} onChange={set("subject")} className={inputCls} data-testid="contact-form-subject" /></Field>
      </div>
      <Field label={t("ct.message")} htmlFor="c-msg"><textarea id="c-msg" rows={5} maxLength={3000} value={form.message} onChange={set("message")} className={inputCls} data-testid="contact-form-message" /></Field>
      <Honeypot value={form.website} onChange={set("website")} />
      <Consent checked={form.consent} onChange={(v) => setForm((f) => ({ ...f, consent: v }))} testid="contact-form-consent" />
      <button type="submit" disabled={sending} data-testid="contact-form-submit"
        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-brand px-8 py-4 font-semibold text-on-dark transition-colors hover:bg-ink disabled:opacity-60">
        {sending && <Loader2 size={18} className="animate-spin" />} {t("ct.submit")}
      </button>
    </form>
  );
}

