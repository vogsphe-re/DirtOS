import 'leaflet/dist/leaflet.css';

import { Alert, Box, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import SunCalc from 'suncalc';
import { useEffect, useMemo, useRef, useState } from 'react';
import { commands } from '../../lib/bindings';
import type { CanvasObject } from './types';

interface OutdoorSiteMapViewProps {
  environmentId: number | null;
  plots: CanvasObject[];
  onOpenPlot: (plotId: string) => void;
}

interface PlotPoint {
  plotId: string;
  label: string;
  lat: number;
  lon: number;
}

function getPlotCenter(plot: CanvasObject): { x: number; y: number } {
  return {
    x: plot.x + (plot.width ?? 40) / 2,
    y: plot.y + (plot.height ?? 40) / 2,
  };
}

function azimuthToBearingDegrees(azimuthRad: number): number {
  return (azimuthRad * (180 / Math.PI) + 180 + 360) % 360;
}

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceMeters: number): L.LatLngExpression {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const ang = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing),
  );

  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1),
    Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
  );

  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

function buildSunTrackPoints(lat: number, lon: number, day: Date, maxRadiusMeters: number): L.LatLngExpression[] {
  const points: L.LatLngExpression[] = [];
  for (let hour = 0; hour < 24; hour += 0.25) {
    const sample = new Date(day);
    sample.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    const sun = SunCalc.getPosition(sample, lat, lon);
    if (sun.altitude <= 0) continue;

    const bearing = azimuthToBearingDegrees(sun.azimuth);
    const normalizedAltitude = Math.max(0, Math.min(1, sun.altitude / (Math.PI / 2)));
    const distance = maxRadiusMeters * (1 - normalizedAltitude);
    points.push(destinationPoint(lat, lon, bearing, distance));
  }

  return points;
}

export function OutdoorSiteMapView({ environmentId, plots, onOpenPlot }: OutdoorSiteMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const sunTrackLayerRef = useRef<L.Polyline | null>(null);
  const [day, setDay] = useState(() => new Date());
  const [mapZoom, setMapZoom] = useState<number>(19);

  const { data: environment } = useQuery({
    queryKey: ['environment-map', environmentId],
    queryFn: async () => {
      if (environmentId == null) return null;
      const result = await commands.getEnvironment(environmentId);
      if (result.status === 'error') throw new Error(result.error);
      return result.data;
    },
    enabled: environmentId != null,
  });

  const lat = environment?.latitude ?? null;
  const lon = environment?.longitude ?? null;

  const plotPoints = useMemo<PlotPoint[]>(() => {
    if (lat == null || lon == null || plots.length === 0) return [];

    const centers = plots.map(getPlotCenter);
    const originX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
    const originY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;

    const metersPerCanvasPixel = 0.08;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = Math.max(1, 111320 * Math.cos((lat * Math.PI) / 180));

    return plots.map((plot) => {
      const center = getPlotCenter(plot);
      const dx = (center.x - originX) * metersPerCanvasPixel;
      const dy = (center.y - originY) * metersPerCanvasPixel;

      return {
        plotId: plot.id,
        label: plot.label?.trim() || 'Unnamed plot',
        lat: lat - dy / metersPerDegreeLat,
        lon: lon + dx / metersPerDegreeLon,
      };
    });
  }, [lat, lon, plots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || lat == null || lon == null) return;

    const map = L.map(container, {
      center: [lat, lon],
      zoom: 19,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    labelsLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        map.invalidateSize({ animate: false });
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      labelsLayerRef.current = null;
      sunTrackLayerRef.current = null;
    };
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lon == null) return;

    map.setView([lat, lon], Math.max(map.getZoom(), 18), { animate: false });

    if (!sunTrackLayerRef.current) {
      sunTrackLayerRef.current = L.polyline([], {
        color: '#f59f00',
        weight: 3,
        opacity: 0.85,
      }).addTo(map);
    }

    // Compute radius from the map's current visible bounds so the arc
    // always occupies a consistent proportion of the viewport regardless
    // of zoom level.
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const halfLatMeters = Math.abs(ne.lat - sw.lat) * 0.5 * 111320;
    const halfLonMeters =
      Math.abs(ne.lng - sw.lng) * 0.5 * 111320 * Math.cos((lat * Math.PI) / 180);
    const maxRadiusMeters = Math.min(halfLatMeters, halfLonMeters) * 0.7;

    sunTrackLayerRef.current.setLatLngs(buildSunTrackPoints(lat, lon, day, maxRadiusMeters));
  }, [day, lat, lon, mapZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const labelsLayer = labelsLayerRef.current;
    if (!map || !labelsLayer) return;

    labelsLayer.clearLayers();

    for (const point of plotPoints) {
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 6,
        color: '#2f9e44',
        weight: 2,
        fillColor: '#d3f9d8',
        fillOpacity: 0.95,
      });

      marker.bindTooltip(point.label, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'dirtos-plot-label-tooltip',
      });

      marker.on('click', () => {
        if (map.getZoom() >= 19) {
          onOpenPlot(point.plotId);
          return;
        }
        map.flyTo([point.lat, point.lon], 19, { duration: 0.4 });
      });

      labelsLayer.addLayer(marker);
    }
  }, [onOpenPlot, plotPoints]);

  if (environmentId == null) {
    return (
      <Box style={{ flex: 1, padding: 12 }}>
        <Alert color='yellow' title='No active environment'>
          Select an environment in Settings to use the outdoor site map.
        </Alert>
      </Box>
    );
  }

  if (lat == null || lon == null) {
    return (
      <Box style={{ flex: 1, padding: 12 }}>
        <Alert color='yellow' title='Location required'>
          Add latitude and longitude for this environment in Settings to import its top-down OpenStreetMap view.
        </Alert>
      </Box>
    );
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
      <Card withBorder padding='sm'>
        <Stack gap={8}>
          <Group justify='space-between' align='center'>
            <Text fw={600}>Outdoor Map Planning (2D)</Text>
            <Group>
              <Text size='sm' c='dimmed'>Sun track date</Text>
              <input
                type='date'
                value={day.toISOString().slice(0, 10)}
                onChange={(event) => {
                  const parsed = new Date(`${event.currentTarget.value}T12:00:00`);
                  if (!Number.isNaN(parsed.getTime())) setDay(parsed);
                }}
              />
            </Group>
          </Group>
          <Text size='sm' c='dimmed'>
            Plot labels are shown at map scale. Click a plot label to open detailed plot-space planning.
          </Text>
          {plots.length > 0 && (
            <Group>
              <Button size='xs' variant='light' onClick={() => onOpenPlot(plots[0].id)}>
                Open plot manager
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
      <Box
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 320,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--mantine-color-default-border)',
        }}
      />
    </Box>
  );
}
