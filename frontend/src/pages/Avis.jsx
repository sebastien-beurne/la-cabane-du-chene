import Seo from "@/components/site/Seo";
import CtaBand from "@/components/site/CtaBand";
import { Eyebrow } from "@/components/site/Motion";
import { useReviews, ReviewCards, Stars } from "@/components/site/Reviews";
import { Btn } from "@/components/site/CtaBand";

export default function Avis() {
  const { list, avg, count, airbnb } = useReviews();
  return (
    <>
      <Seo title="Avis clients — La Cabane du Chêne, gîte insolite à Valmunster"
        description="Les témoignages de voyageurs ayant séjourné à La Cabane du Chêne, cabane avec bain nordique à Valmunster (Moselle)." path="/avis-clients" />
      <section data-testid="avis-page" className="bg-[#FBF9F5] pt-36 pb-24">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <Eyebrow>Avis clients</Eyebrow>
          <h1 className="mt-4 text-5xl md:text-6xl font-medium leading-[1.02] text-[#1B2B24]">Ils ont séjourné à la cabane</h1>
          {count > 0 && <p className="mt-5 flex items-center gap-3 text-[#33423A]"><Stars n={avg} size={20} /> <strong>{avg.toFixed(1).replace(".", ",")} / 5</strong> sur {count} avis</p>}
          <div className="mt-12">
            {list.length ? <ReviewCards list={list} /> : <p className="text-[#526058]">Les premiers témoignages arrivent bientôt.</p>}
          </div>
          {airbnb && <div className="mt-12"><Btn href={airbnb} variant="ghost" testid="avis-airbnb">Lire aussi nos avis sur Airbnb</Btn></div>}
        </div>
      </section>
      <CtaBand />
    </>
  );
}

