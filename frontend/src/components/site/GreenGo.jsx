import { ArrowUpRight, Leaf } from "lucide-react";
import { useSite } from "@/lib/site";
import { useT } from "@/lib/i18n";

export default function GreenGoLink({ className = "", light = false, testid = "greengo-link" }) {
  const url = useSite()?.content?.general?.greengo_url;
  const { t } = useT();
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" data-testid={testid} data-no-translate
      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors ${light ? "border border-white/30 text-on-dark hover:bg-white/10" : "border border-brand/30 bg-sand text-ink hover:bg-brand hover:text-on-dark"} ${className}`}>
      <Leaf size={16} /> {t("greengo")} <ArrowUpRight size={14} />
    </a>
  );
}

