import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ArrowUpRight, Footprints } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Eyebrow } from "./Motion";

const WALK_COLORS = ["#B35432", "#2D4A3E", "#7A5C99", "#C28B2C", "#2B6CB0"];
const CENTER = [49.243239, 6.503507];

const parse = (s) => {
  const m = String(s || "").split(",").map((x) => Number(x.trim()));
  return m.length === 2 && m.every((n) => Number.isFinite(n)) ? m : null;
};

function FitTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target?.length) map.flyToBounds(target, { padding: [30, 30], duration: 0.8, maxZoom: 14 });
  }, [map, target]);
  return null;
}

function WalkButton({ w, color, active, onClick }) {
  return (
    <button type="button" onClick={onClick} data-testid={`map-walk-${w.id}`}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${active ? "border-[#1B2B24] bg-white" : "border-[#2D4A3E]/15 bg-white/60 hover:bg-white"}`}>
      <span className="h-1.5 w-6 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-[#1B2B24]">{w.name.replace(", France", "")}</span>
      {w.km && <span className="shrink-0 tabular-nums text-[#526058]">{String(w.km).replace(".", ",")} km</span>}
    </button>
  );
}

export default function ValmunsterMap({ places }) {
  const [walks, setWalks] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(() => {
    fetch("/data/balades.json").then((r) => r.json()).then((d) => setWalks(Array.isArray(d?.walks) ? d.walks : [])).catch(() => setWalks([]));
  }, []);
  const pins = useMemo(() => (places || []).map((p) => ({ ...p, pos: parse(p.coords) })).filter((p) => p.pos), [places]);
  const allPts = useMemo(() => [...pins.map((p) => p.pos), ...walks.flatMap((w) => w.lines.flat())], [pins, walks]);
  const target = active === null ? (allPts.length ? allPts : null) : walks.find((w) => w.id === active)?.lines.flat();

  return (
    <section data-testid="surroundings-map" className="bg-[#EFEAE1] py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow>La carte du coin</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-medium leading-[1.05] text-[#1B2B24]">Valmunster, au cœur de la Moselle</h2>
          <p className="mt-5 text-[#33423A] leading-relaxed">Retrouvez la cabane à Valmunster. Les liens du guide ouvrent les itinéraires vers les lieux à visiter.</p>
          <button type="button" onClick={() => setActive(null)} className={`mt-6 text-sm font-semibold underline underline-offset-4 ${active === null ? "text-[#526058]" : "text-[#B35432]"}`} data-testid="map-show-all">Tout afficher</button>
          <div className="mt-3 space-y-2" data-testid="map-walks">
            {walks.map((w, i) => <WalkButton key={w.id} w={w} color={WALK_COLORS[i % WALK_COLORS.length]} active={active === w.id} onClick={() => setActive(w.id)} />)}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#526058]"><span className="h-3 w-3 rounded-full border-2 border-white bg-[#1B2B24]" /> Carte © OpenStreetMap</p>
        </div>
        <div className="lg:col-span-8">
          <div className="relative isolate h-[420px] md:h-[560px] overflow-hidden rounded-md border border-[#2D4A3E]/15 bg-[#DDE3DA]" data-testid="map-canvas">
            <MapContainer center={CENTER} zoom={10} scrollWheelZoom={false} className="h-full w-full" attributionControl>
              <CircleMarker center={CENTER} radius={10} pathOptions={{ color: "#fff", fillColor: "#B35432", fillOpacity: 1 }}><Tooltip>La Cabane du Chêne</Tooltip><Popup>8 rue de la forêt, 57220 Valmunster</Popup></CircleMarker>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
              {walks.map((w, i) => w.lines.map((line, j) => (
                <Polyline key={`${w.id}-${j}`} positions={line} eventHandlers={{ click: () => setActive(w.id) }}
                  pathOptions={{ color: WALK_COLORS[i % WALK_COLORS.length], weight: active === w.id ? 6 : 4, opacity: active === null || active === w.id ? 0.9 : 0.35, dashArray: "8 6" }}>
                  {j === 0 && <Tooltip sticky>{w.name}</Tooltip>}
                </Polyline>
              )))}
              {pins.map((p) => (
                <CircleMarker key={p.name} center={p.pos} radius={p.name.toLowerCase().includes("citadelle") ? 11 : 8}
                  pathOptions={{ color: "#ffffff", weight: 3, fillColor: p.name.toLowerCase().includes("citadelle") ? "#B35432" : "#1B2B24", fillOpacity: 1 }}>
                  <Tooltip direction="top" offset={[0, -8]}>{p.name}</Tooltip>
                  <Popup>
                    <strong>{p.name}</strong><br />{p.category}
                    {p.maps && <><br /><a href={p.maps} target="_blank" rel="noreferrer">Itinéraire Google Maps</a></>}
                  </Popup>
                </CircleMarker>
              ))}
              <FitTo target={target} />
            </MapContainer>
          </div>
          {active !== null && (() => {
            const w = walks.find((x) => x.id === active);
            return w ? (
              <a href={w.url} target="_blank" rel="noreferrer" data-testid="map-walk-details" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#B35432] hover:underline underline-offset-4">
                <Footprints size={16} /> Détails et profil de « {w.name.replace(", France", "")} » <ArrowUpRight size={14} />
              </a>
            ) : null;
          })()}
        </div>
      </div>
    </section>
  );
}

