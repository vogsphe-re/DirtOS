/**
 * WeatherRadarMap – Leaflet map with live OWM precipitation / cloud radar tiles.
 * Uses OpenStreetMap for the base and OpenWeatherMap tile layers for radar.
 * If no OWM key is supplied the radar layer is omitted but the base map renders.
 */
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

// Fix Leaflet's missing marker icon when bundled with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type RadarLayer = "precipitation_new" | "clouds_new" | "wind_new" | "temp_new";

interface Props {
  latitude: number;
  longitude: number;
  owmApiKey?: string | null;
  layer?: RadarLayer;
  zoom?: number;
  height?: number;
}

export function WeatherRadarMap({
  latitude,
  longitude,
  owmApiKey,
  layer = "precipitation_new",
  zoom = 7,
  height = 340,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const radarRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (owmApiKey) {
      const radar = L.tileLayer(
        `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${owmApiKey}`,
        { opacity: 0.65, attribution: '© <a href="https://openweathermap.org">OpenWeatherMap</a>' }
      );
      radar.addTo(map);
      radarRef.current = radar;
    }

    // Pin the location
    L.marker([latitude, longitude]).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      radarRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once – deliberately ignores prop changes; layer updates handled below

  // Update radar layer when layer prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !owmApiKey) return;
    if (radarRef.current) {
      map.removeLayer(radarRef.current);
    }
    const radar = L.tileLayer(
      `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${owmApiKey}`,
      { opacity: 0.65, attribution: '© <a href="https://openweathermap.org">OpenWeatherMap</a>' }
    );
    radar.addTo(map);
    radarRef.current = radar;
  }, [layer, owmApiKey]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
    />
  );
}
