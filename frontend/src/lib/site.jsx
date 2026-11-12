import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { http } from "./api";
import seed from "@/data/site.json";

const SiteCtx = createContext(null);

export function SiteProvider({ children }) {
  const [content, setContent] = useState(seed.content);
  const [photos, setPhotos] = useState(seed.photos);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([http.get("/content"), http.get("/photos")]);
      setContent(c.data && typeof c.data === "object" ? c.data : null);
      setPhotos(Array.isArray(p.data) ? p.data : []);
    } catch (e) {
      setContent(seed.content); setPhotos(seed.photos);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => {
    const byCat = (cat) => photos.filter((p) => p.category === cat);
    const pick = (...cats) => cats.map((c) => byCat(c)[0]).find(Boolean) || null;
    const gallery = photos.filter((p) => p.category !== "guide");
    return { content, photos, gallery, byCat, pick, ready, reload: load, setContent };
  }, [content, photos, ready, load]);

  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export const useSite = () => useContext(SiteCtx);

export const FALLBACK = {
  hero_title: "Le calme, tout simplement.",
  hero_subtitle:
    "Une cabane en bois brûlé, un spa privatif et le petit déjeuner inclus, en Moselle.",
};

