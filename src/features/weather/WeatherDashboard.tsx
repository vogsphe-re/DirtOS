import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCloudRain,
  IconDroplet,
  IconEye,
  IconGauge,
  IconRefresh,
  IconSettings,
  IconSun,
  IconThermometer,
  IconWind,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { DailyForecast, WeatherData } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { useWeatherStore } from "../../stores/weatherStore";
import { useUnits, type UnitFormatters } from "../../lib/units";
import { ForecastChart } from "./ForecastChart";
import { WeatherAlertSettingsPanel } from "./WeatherAlertSettingsPanel";
import type { RadarLayer } from "./WeatherRadarMap";
import { WeatherRadarMap } from "./WeatherRadarMap";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function owmIconUrl(icon: string, size: "@2x" | "" = "@2x") {
  return `https://openweathermap.org/img/wn/${icon}${size}.png`;
}

function windDegToCompass(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function uvLabel(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: "Low", color: "green" };
  if (uv < 6) return { label: "Moderate", color: "yellow" };
  if (uv < 8) return { label: "High", color: "orange" };
  if (uv < 11) return { label: "Very High", color: "red" };
  return { label: "Extreme", color: "violet" };
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card padding="sm" radius="sm" withBorder>
      <Group gap="xs" align="flex-start">
        <Box c="dimmed" pt={2}>{icon}</Box>
        <Box>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="sm" fw={600}>{value}</Text>
          {sub && <Text size="xs" c="dimmed">{sub}</Text>}
        </Box>
      </Group>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 10-day forecast card
// ---------------------------------------------------------------------------

function DayCard({ day, fmt }: { day: DailyForecast; fmt: UnitFormatters }) {
  const date = new Date(day.date + "T12:00:00");
  return (
    <Card padding="xs" radius="sm" withBorder ta="center">
      <Text size="xs" fw={600}>{date.toLocaleDateString([], { weekday: "short" })}</Text>
      <Text size="xs" c="dimmed">{date.toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
      {day.icon && (
        <img src={owmIconUrl(day.icon, "")} alt={day.description} style={{ width: 36, margin: "2px auto" }} />
      )}
      <Text size="xs" style={{ textTransform: "capitalize" }} c="dimmed" lineClamp={1}>
        {day.description}
      </Text>
      <Group justify="center" gap={4} mt={2}>
        <Text size="xs" fw={700} c="orange">{fmt.tempShort(day.temp_max_c)}</Text>
        <Text size="xs" c="dimmed">/ {fmt.tempShort(day.temp_min_c)}</Text>
      </Group>
      {day.precipitation_prob != null && day.precipitation_prob > 0 && (
        <Text size="xs" c="blue">💧 {Math.round(day.precipitation_prob * 100)}%</Text>
      )}
      {day.precipitation_sum_mm != null && day.precipitation_sum_mm > 0 && (
        <Text size="xs" c="cyan">{fmt.precip(day.precipitation_sum_mm)}</Text>
      )}
      {day.uv_index_max != null && (
        <Text size="xs" c={uvLabel(day.uv_index_max).color}>
          UV {day.uv_index_max.toFixed(0)}
        </Text>
      )}
      {day.wind_speed_max_ms != null && (
        <Text size="xs" c="dimmed">💨 {fmt.wind(day.wind_speed_max_ms)}</Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function WeatherDashboard() {
  const qc = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const setWeather = useWeatherStore((s) => s.setWeather);
  const fmt = useUnits();

  const [radarLayer, setRadarLayer] = useState<RadarLayer>("radar");

  const {
    data: weather,
    isLoading,
    error,
  } = useQuery<WeatherData | null>({
    queryKey: ["weather", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return null;
      const res = await commands.getWeather(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data ?? null;
    },
    enabled: !!activeEnvId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync to shared weather store so other features can read it
  useEffect(() => {
    setWeather(weather ?? null, activeEnvId);
  }, [weather, activeEnvId, setWeather]);

  const refreshMut = useMutation({
    mutationFn: async () => {
      if (!activeEnvId) return;
      const res = await commands.refreshWeather(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weather", activeEnvId] });
      notifications.show({ message: "Weather refreshed", color: "blue" });
    },
    onError: (e: Error) => {
      notifications.show({ message: e.message, color: "red", title: "Refresh failed" });
    },
  });

  if (!activeEnvId) {
    return (
      <Stack p="md">
        <Title order={2}>Weather</Title>
        <Text c="dimmed">Select an environment in Settings to view weather data.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="lg">
      <Group justify="space-between">
        <Title order={2}>Weather</Title>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={14} />}
          loading={refreshMut.isPending}
          onClick={() => refreshMut.mutate()}
        >
          Refresh
        </Button>
      </Group>

      {/* Loading */}
      {isLoading && (
        <Group>
          <Loader size="sm" />
          <Text c="dimmed" size="sm">Fetching weather from Open-Meteo…</Text>
        </Group>
      )}

      {/* Error */}
      {error && !isLoading && (
        <Card withBorder p="md">
          <Text c="red" size="sm" fw={500}>Failed to load weather</Text>
          <Text c="dimmed" size="sm">{(error as Error).message}</Text>
        </Card>
      )}

      {/* No location */}
      {!isLoading && !weather && !error && (
        <Card withBorder p="md">
          <Text fw={500} mb={4}>No location configured</Text>
          <Text c="dimmed" size="sm">
            Add latitude and longitude to this environment in{" "}
            <Text component="span" c="blue">Settings → Environments</Text>.
            Weather data is fetched for free from Open-Meteo — no API key required.
          </Text>
        </Card>
      )}

      {weather && (
        <Tabs defaultValue="conditions">
          <Tabs.List>
            <Tabs.Tab value="conditions" leftSection={<IconThermometer size={14} />}>
              Current
            </Tabs.Tab>
            <Tabs.Tab value="forecast" leftSection={<IconSun size={14} />}>
              10-Day Forecast
            </Tabs.Tab>
            <Tabs.Tab value="hourly" leftSection={<IconCloudRain size={14} />}>
              Hourly
            </Tabs.Tab>
            <Tabs.Tab value="radar" leftSection={<IconEye size={14} />}>
              Radar Map
            </Tabs.Tab>
            <Tabs.Tab value="alerts" leftSection={<IconSettings size={14} />}>
              Alert Thresholds
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Current Conditions ───────────────────────────────── */}
          <Tabs.Panel value="conditions" pt="md">
            <Stack gap="md">
              <Card withBorder p="md" radius="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Group gap="md" align="center">
                    {weather.current.icon && (
                      <img
                        src={owmIconUrl(weather.current.icon)}
                        alt={weather.current.description}
                        style={{ width: 80 }}
                      />
                    )}
                    <Box>
                      <Text size="48" fw={800} lh={1}>
                        {fmt.temp(weather.current.temperature_c)}
                      </Text>
                      <Text size="sm" c="dimmed" style={{ textTransform: "capitalize" }}>
                        {weather.current.description}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Feels like {fmt.temp(weather.current.feels_like_c)}
                      </Text>
                      {weather.daily[0] && (
                        <Text size="xs" c="dimmed">
                          High {fmt.tempShort(weather.daily[0].temp_max_c)} · Low {fmt.tempShort(weather.daily[0].temp_min_c)}
                        </Text>
                      )}
                    </Box>
                  </Group>
                  <Stack gap={4} align="flex-end">
                    {weather.from_cache && (
                      <Badge size="xs" color="gray" variant="outline">Cached</Badge>
                    )}
                    <Text size="xs" c="dimmed">
                      {weather.latitude?.toFixed(4)}°, {weather.longitude?.toFixed(4)}°
                    </Text>
                  </Stack>
                </Group>

                <Divider my="sm" />

                <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
                  <StatCard
                    icon={<IconDroplet size={16} />}
                    label="Humidity"
                    value={`${weather.current.humidity}%`}
                  />
                  <StatCard
                    icon={<IconWind size={16} />}
                    label="Wind"
                    value={fmt.wind(weather.current.wind_speed_ms)}
                    sub={windDegToCompass(weather.current.wind_direction_deg)}
                  />
                  {weather.current.wind_gust_ms != null && (
                    <StatCard
                      icon={<IconWind size={16} />}
                      label="Gusts"
                      value={fmt.wind(weather.current.wind_gust_ms)}
                    />
                  )}
                  <StatCard
                    icon={<IconGauge size={16} />}
                    label="Pressure"
                    value={`${Math.round(weather.current.pressure_hpa)} hPa`}
                  />
                  {weather.current.dew_point_c != null && (
                    <StatCard
                      icon={<IconDroplet size={16} />}
                      label="Dew Point"
                      value={fmt.temp(weather.current.dew_point_c)}
                    />
                  )}
                  {weather.current.visibility_m != null && (
                    <StatCard
                      icon={<IconEye size={16} />}
                      label="Visibility"
                      value={fmt.visibility(weather.current.visibility_m)}
                    />
                  )}
                  {weather.current.uv_index != null && (
                    <StatCard
                      icon={<IconSun size={16} />}
                      label="UV Index"
                      value={`${weather.current.uv_index.toFixed(1)} — ${uvLabel(weather.current.uv_index).label}`}
                    />
                  )}
                  {weather.current.sunrise != null && (
                    <StatCard
                      icon={<IconSun size={16} />}
                      label="Sunrise"
                      value={formatTs(weather.current.sunrise)}
                    />
                  )}
                  {weather.current.sunset != null && (
                    <StatCard
                      icon={<IconSun size={16} />}
                      label="Sunset"
                      value={formatTs(weather.current.sunset)}
                    />
                  )}
                </SimpleGrid>
              </Card>

              <Text size="xs" c="dimmed">
                Data from Open-Meteo · Last updated: {weather.fetched_at.replace("T", " ")}
              </Text>
            </Stack>
          </Tabs.Panel>

          {/* ── 10-Day Forecast ──────────────────────────────────── */}
          <Tabs.Panel value="forecast" pt="md">
            <Stack gap="sm">
              {weather.daily.length > 0 ? (
                <>
                  <Text fw={600}>{weather.daily.length}-Day Forecast</Text>
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs">
                    {weather.daily.map((day) => (
                      <DayCard key={day.date} day={day} fmt={fmt} />
                    ))}
                  </SimpleGrid>
                </>
              ) : (
                <Text c="dimmed" size="sm">No forecast data available.</Text>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Hourly Chart ─────────────────────────────────────── */}
          <Tabs.Panel value="hourly" pt="md">
            <Stack gap="sm">
              <Text fw={600}>Next 48 Hours — Temperature & Precipitation</Text>
              <Card withBorder p="sm">
                {weather.hourly.length > 0 ? (
                  <ForecastChart hourly={weather.hourly} />
                ) : (
                  <Text c="dimmed" size="sm">No hourly data.</Text>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* ── Radar Map ────────────────────────────────────────── */}
          <Tabs.Panel value="radar" pt="md">
            <Stack gap="sm">
              <Group>
                <Text size="sm" fw={500}>Overlay:</Text>
                <SegmentedControl
                  size="xs"
                  value={radarLayer}
                  onChange={(v) => setRadarLayer(v as RadarLayer)}
                  data={[
                    { label: "Radar", value: "radar" },
                    { label: "Satellite", value: "satellite" },
                    { label: "24h Rain", value: "precip_24h" },
                    { label: "7-Day Rain", value: "precip_7d" },
                  ]}
                />
              </Group>
              {weather.latitude != null && weather.longitude != null ? (
                <Card withBorder p={0} radius="md" style={{ overflow: "hidden" }}>
                  <WeatherRadarMap
                    latitude={weather.latitude}
                    longitude={weather.longitude}
                    layer={radarLayer}
                    height={440}
                  />
                </Card>
              ) : (
                <Text c="dimmed" size="sm">Coordinates not available for radar map.</Text>
              )}
              <Text size="xs" c="dimmed">
                Radar &amp; Satellite: RainViewer / NOAA NEXRAD &amp; GOES · Precipitation: Iowa Env. Mesonet / NOAA MRMS
              </Text>
            </Stack>
          </Tabs.Panel>

          {/* ── Alert Thresholds ─────────────────────────────────── */}
          <Tabs.Panel value="alerts" pt="md">
            <WeatherAlertSettingsPanel />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}
