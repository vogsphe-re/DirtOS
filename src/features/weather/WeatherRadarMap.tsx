/**
 * WeatherRadarMap – Leaflet map with free public weather overlay tiles.
 * No API key required. Data sources:
 *   Radar / Satellite : RainViewer public API (global composite, ~5-min updates)
 *   Precipitation QPE : Iowa Environmental Mesonet / NOAA MRMS (US only)
 */
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// Fix Leaflet's missing marker icon when bundled with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type RadarLayer = "radar" | "satellite" | "precip_24h" | "precip_7d";

interface RainViewerFrame { time: number; path: string }
interface RainViewerManifest {
  host: string;
  radar: { past: RainViewerFrame[] };
  satellite: { infrared: RainViewerFrame[] };
}

/** Build tile layer for the requested overlay using free public data. */
function buildOverlay(layer: RadarLayer, rv: RainViewerManifest | null): L.TileLayer {
  const iem = (product: string) =>
    L.tileLayer(
      `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${product}/{z}/{x}/{y}.png`,
      {
        opacity: 0.75,
        attribution:
          '© <a href="https://mesonet.agron.iastate.edu/" target="_blank">Iowa Env. Mesonet / NOAA MRMS</a>',
      }
    );

  if (layer === "precip_24h") return iem("q2-1d-900913");
  if (layer === "precip_7d") return iem("q2-7d-900913");

  const host = rv?.host ?? "https://tilecache.rainviewer.com";

  if (layer === "satellite") {
    const latest = rv?.satellite?.infrared?.at(-1);
    if (latest) {
      return L.tileLayer(`${host}${latest.path}/256/{z}/{x}/{y}/0/0_0.png`, {
        opacity: 0.7,
        attribution:
          '© <a href="https://www.rainviewer.com/" target="_blank">RainViewer / GOES</a>',
      });
    }
  }

  // Radar — RainViewer NEXRAD composite, fallback to IEM static
  const latestRadar = rv?.radar?.past?.at(-1);
  if (latestRadar) {
    return L.tileLayer(`${host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0.65,
      attribution:
        '© <a href="https://www.rainviewer.com/" target="_blank">RainViewer / NOAA NEXRAD</a>',
    });
  }

  return iem("nexrad-n0q-900913");
}

interface Props {
  latitude: number;
  longitude: number;
  layer?: RadarLayer;
  zoom?: number;
  height?: number;
}

export function WeatherRadarMap({
  latitude,
  longitude,
  layer = "radar",
  zoom = 7,
  height = 340,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const [rvManifest, setRvManifest] = useState<RainViewerManifest | null>(null);

  // Fetch RainViewer manifest — free public API, no key required, refresh every 5 min
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) return;
        const data: RainViewerManifest = await res.json();
        if (!cancelled) setRvManifest(data);
      } catch {
        // RainViewer unavailable; IEM static fallback used for radar
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Mount Leaflet map once.
  // NOTE: this component is often rendered inside a Mantine Tabs.Panel that starts
  // hidden (display:none). Leaflet initialises with a 0×0 viewport in that case,
  // so tiles never load and the centre is wrong. We fix both by attaching a
  // ResizeObserver: the first time the container gets a nonzero size (i.e. the tab
  // becomes visible), we call invalidateSize() + setView() so tiles load correctly.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.marker([latitude, longitude]).addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        map.invalidateSize({ animate: false });
        map.setView([latitude, longitude], zoom, { animate: false });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap overlay whenever layer or manifest changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (overlayRef.current) map.removeLayer(overlayRef.current);
    const overlay = buildOverlay(layer, rvManifest);
    overlay.addTo(map);
    overlayRef.current = overlay;
  }, [layer, rvManifest]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
    />
  );
}
