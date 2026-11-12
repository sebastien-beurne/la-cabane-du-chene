import { useSearchParams } from "react-router-dom";
import Seo from "@/components/site/Seo";
import GiftCardsAdapter from "@/components/site/GiftCardsAdapter";
import { GiftCardPurchase } from "@/features/gift-cards";

export default function CarteCadeau() {
  const [params] = useSearchParams();
  return <>
    <Seo title="Carte cadeau — La Cabane du Chêne, Valmunster" description="Offrez une carte cadeau d’un montant libre ou un crédit séjour à La Cabane du Chêne." path="/carte-cadeau" />
    <section className="min-h-[100svh] bg-[#FBF9F5] pt-32 md:pt-44 pb-24">
      <div className="mx-auto max-w-3xl px-5">
        <GiftCardsAdapter><GiftCardPurchase sessionId={params.get("session_id")} cancelled={!!params.get("annule")} /></GiftCardsAdapter>
      </div>
    </section>
  </>;
}

