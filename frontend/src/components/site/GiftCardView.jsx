import GiftCardsAdapter from "./GiftCardsAdapter";
import { GiftCardView as View } from "@/features/gift-cards";

export default function GiftCardView(props) {
  return <GiftCardsAdapter><View {...props} /></GiftCardsAdapter>;
}

