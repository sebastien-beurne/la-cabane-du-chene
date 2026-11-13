import { useState } from "react";
import { Play } from "lucide-react";
import { useSite } from "@/lib/site";
import { img } from "@/lib/api";
import { Reveal, Eyebrow } from "./Motion";

function ytId(url = "") {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function Video({ v, i }) {
  const [play, setPlay] = useState(false);
  const id = ytId(v.url);
  return (
    <Reveal delay={i * 0.1} className="space-y-4" data-testid={`video-${i}`}>
      <div className="relative aspect-video overflow-hidden rounded-md bg-ink">
        {id ? (
          play ? (
            <iframe title={v.title} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
          ) : (
            <button type="button" onClick={() => setPlay(true)} data-testid={`video-play-${i}`} className="group absolute inset-0" aria-label={`Lire : ${v.title}`}>
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 grid place-items-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-paper/95 text-ink shadow-xl"><Play size={24} fill="currentColor" /></span></span>
            </button>
          )
        ) : (
          <video src={img(v.url)} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        )}
      </div>
      <h3 className="text-2xl font-medium text-ink">{v.title}</h3>
    </Reveal>
  );
}

export default function Videos() {
  const c = useSite()?.content || {};
  const list = (Array.isArray(c.videos) ? c.videos : []).filter((v) => v?.url && v?.active !== false);
  if (!list.length) return null;
  return (
    <section data-testid="videos-section" className="bg-canvas py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <Reveal className="mb-12"><Eyebrow>En vidéo</Eyebrow><h2 className="mt-4 text-4xl md:text-5xl font-medium text-ink">{c.home?.videos_title || "La cabane en vidéo"}</h2></Reveal>
        <div className={`grid gap-8 ${list.length > 1 ? "md:grid-cols-2" : "max-w-4xl"}`}>
          {list.map((v, i) => <Video key={i} v={v} i={i} />)}
        </div>
      </div>
    </section>
  );
}

