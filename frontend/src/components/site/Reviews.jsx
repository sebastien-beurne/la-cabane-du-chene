import { Quote, Star } from "lucide-react";
import { useSite } from "@/lib/site";
import { Reveal, Eyebrow } from "./Motion";
import { Btn } from "./CtaBand";

export function Stars({ n = 5, size = 16 }) {
  return (
    <span className="inline-flex gap-0.5 text-[#D4A373]" aria-label={`${n} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} fill={i <= Math.round(n) ? "currentColor" : "none"} strokeWidth={1.5} />)}
    </span>
  );
}

export function useReviews() {
  const c = useSite()?.content || {};
  const list = (Array.isArray(c.reviews) ? c.reviews : []).filter((r) => r?.text && r?.active !== false);
  const rated = list.map((r) => Number(r.rating)).filter((x) => x >= 1 && x <= 5);
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
  return { list, avg, count: rated.length, airbnb: c.general?.airbnb_url };
}

export function ReviewCards({ list }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {list.map((r, i) => (
        <Reveal key={i} delay={(i % 3) * 0.08} className="flex flex-col rounded-md bg-[#F8F5F0] p-7" data-testid={`review-${i}`}>
          <div className="flex items-center justify-between"><Quote className="text-[#B35432]" size={22} />{Number(r.rating) > 0 && <Stars n={Number(r.rating)} />}</div>
          <p className="mt-4 flex-1 font-display text-xl leading-snug text-[#1B2B24]">« {r.text} »</p>
          <p className="mt-5 text-sm text-[#526058]">{r.author}{r.date ? ` · ${r.date}` : ""}{r.source ? ` · ${r.source}` : ""}</p>
        </Reveal>
      ))}
    </div>
  );
}

export default function ReviewsSection({ limit = 3, showAllLink = true }) {
  const { list, avg, count, airbnb } = useReviews();
  if (!list.length && !airbnb) return null;
  return (
    <section data-testid="reviews-section" className="bg-[#EFEAE1] py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Avis clients</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-medium leading-[1.05] text-[#1B2B24]">La parole à nos voyageurs</h2>
            {count > 0 && (
              <p className="mt-4 flex items-center gap-3 text-[#33423A]" data-testid="reviews-average">
                <Stars n={avg} size={18} /> <strong className="text-[#1B2B24]">{avg.toFixed(1).replace(".", ",")} / 5</strong> · {count} avis
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {showAllLink && list.length > limit && <Btn to="/avis-clients" variant="ghost" testid="reviews-all-link">Tous les avis</Btn>}
            {airbnb && <Btn href={airbnb} variant="ghost" testid="reviews-airbnb-link">Avis sur Airbnb</Btn>}
          </div>
        </Reveal>
        {list.length > 0 && <div className="mt-12"><ReviewCards list={list.slice(0, limit)} /></div>}
      </div>
    </section>
  );
}

