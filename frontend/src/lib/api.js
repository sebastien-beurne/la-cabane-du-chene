import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BASE}/api`;
export const http = axios.create({ baseURL: API, withCredentials: true });

const LANG_ENDPOINTS = ["/booking-requests", "/contact", "/gift-cards/checkout"];
http.interceptors.request.use((cfg) => {
  if (LANG_ENDPOINTS.includes(cfg.url) && cfg.data && typeof cfg.data === "object" && !(cfg.data instanceof FormData)) {
    cfg.data = { ...cfg.data, lang: localStorage.getItem("site_lang") || document.documentElement.lang || "fr" };
  }
  return cfg;
});

let refreshing = null;
http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || "";
    if (error.response?.status === 401 && !cfg._retry && !url.startsWith("/auth/")) {
      cfg._retry = true;
      refreshing = refreshing || http.post("/auth/refresh").finally(() => { refreshing = null; });
      try {
        await refreshing;
        return http(cfg);
      } catch (e) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

const SMALL = typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches;
// Photos are resized server-side for phones (lighter pages on Android); videos/PDF untouched.
export const img = (u) => {
  if (!u || !u.startsWith("/api/")) return u || "";
  const photo = u.startsWith("/api/files/") && !/\.(mp4|mov|webm|pdf)(#|$)/i.test(u);
  return `${BASE}${u}${photo && !/[?&]w=/.test(u) ? `${u.includes("?") ? "&" : "?"}w=${SMALL ? 1000 : 1600}` : ""}`;
};

export function errMsg(e, fallback = "Une erreur est survenue. Merci de réessayer.") {
  const d = e?.response?.data?.detail;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return "Merci de vérifier les champs du formulaire.";
  return fallback;
}

