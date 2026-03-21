import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCloud,
  IconDroplet,
  IconRefresh,
  IconSun,
  IconTemperature,
  IconWind,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DailyForecast, WeatherData } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { ForecastChart } from "./ForecastChart";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function owmIconUrl(icon: string) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function windDegToCompass(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function formatUnixTime(unix: number, format: "time" | "date") {
  const d = new Date(unix * 1000);
  if (format === "time") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card padding="sm" radius="sm" withBorder>
      <Group gap="xs">
        <Box c="dimmed">{icon}</Box>
        <Box>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="sm" fw={600}>{value}</Text>
        </Box>
      </Group>
    </Card>
  );
}

function DayCard({ day }: { day: DailyForecast }) {
  const date = new Date(day.date + "T12:00:00");
  return (
    <Card padding="xs" radius="sm" withBorder ta="center">
      <Text size="xs" fw={600}>
        {date.toLocaleDateString([], { weekday: "short" })}
      </Text>
      <Text size="xs" c="dimmed">
        {date.toLocaleDateString([], { month: "short", day: "numeric" })}
      </Text>
      {day.icon && (
        <img
          src={owmIconUrl(day.icon)}
          alt={day.description}
          style={{ width: 40, margin: "0 auto" }}
        />
      )}
      <Text size="xs" fw={600} c="orange">{Math.round(day.temp_max_c)}°</Text>
      <Text size="xs" c="dimmed">{Math.round(day.temp_min_c)}°</Text>
      {day.precipitation_prob != null && (
        <Text size="xs" c="blue">💧 {Math.round(day.precipitation_prob * 100)}%</Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// API key setup panel
// ---------------------------------------------------------------------------

function ApiKeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await commands.setWeatherApiKey(key.trim());
      if (res.status === "error") throw new Error(res.error);
      notifications.show({ message: "API key saved", color: "green" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder p="md" maw={480}>
      <Stack gap="sm">
        <Title order={5}>OpenWeather API Key Required</Title>
        <Text size="sm" c="dimmed">
          Enter a free-tier API key from{" "}
          <Text component="span" c="blue" style={{ cursor: "default" }}>
            openweathermap.org
          </Text>{" "}
          to enable weather data. Your key is stored locally on this device.
        </Text>
        <PasswordInput
          placeholder="Paste your API key here…"
          value={key}
          onChange={(e) => setKey(e.currentTarget.value)}
        />
        <Button onClick={save} loading={saving} disabled={!key.trim()}>
          Save &amp; Load Weather
        </Button>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function WeatherDashboard() {
  const qc = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const { data: apiKey, refetch: refetchKey } = useQuery<string | null>({
    queryKey: ["weather-api-key"],
    queryFn: async () => {
      const res = await commands.getWeatherApiKey();
      if (res.status === "error") throw new Error(res.error);
      return res.data ?? null;
    },
  });

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
    enabled: !!activeEnvId && !!apiKey,
    staleTime: 5 * 60 * 1000,
  });

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
        <Text c="dimmed">Select an environment in Settings to view weather.</Text>
      </Stack>
    );
  }

  const hasApiKey = !!apiKey;

  return (
    <Stack p="md" gap="lg">
      <Group justify="space-between">
        <Title order={2}>Weather</Title>
        {hasApiKey && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={refreshMut.isPending}
            onClick={() => refreshMut.mutate()}
          >
            Refresh
          </Button>
        )}
      </Group>

      {/* API key setup */}
      {!hasApiKey && (
        <ApiKeySetup
          onSaved={() => {
            refetchKey();
            qc.invalidateQueries({ queryKey: ["weather", activeEnvId] });
          }}
        />
      )}

      {/* Loading */}
      {hasApiKey && isLoading && (
        <Group>
          <Loader size="sm" />
          <Text c="dimmed" size="sm">Loading weather…</Text>
        </Group>
      )}

      {/* Error */}
      {hasApiKey && error && (
        <Text c="red" size="sm">{(error as Error).message}</Text>
      )}

      {/* No location */}
      {hasApiKey && !isLoading && !weather && !error && (
        <Text c="dimmed" size="sm">
          No location set for this environment. Add latitude &amp; longitude in Settings.
        </Text>
      )}

      {/* Weather content */}
      {weather && (
        <>
          {/* Current conditions */}
          <Card withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="md" align="center">
                {weather.current.icon && (
                  <img
                    src={owmIconUrl(weather.current.icon)}
                    alt={weather.current.description}
                    style={{ width: 72 }}
                  />
                )}
                <Box>
                  <Text size="42" fw={700} lh={1}>
                    {Math.round(weather.current.temperature_c)}°C
                  </Text>
                  <Text size="sm" c="dimmed" style={{ textTransform: "capitalize" }}>
                    {weather.current.description}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Feels like {Math.round(weather.current.feels_like_c)}°C
                  </Text>
                </Box>
              </Group>
              {weather.from_cache && (
                <Badge size="xs" color="gray" variant="outline">
                  Offline · Cached
                </Badge>
              )}
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} mt="md" spacing="xs">
              <StatCard
                icon={<IconDroplet size={16} />}
                label="Humidity"
                value={`${weather.current.humidity}%`}
              />
              <StatCard
                icon={<IconWind size={16} />}
                label="Wind"
                value={`${weather.current.wind_speed_ms.toFixed(1)} m/s ${windDegToCompass(weather.current.wind_direction_deg)}`}
              />
              <StatCard
                icon={<IconCloud size={16} />}
                label="Cloud cover"
                value={`${weather.current.cloud_cover_pct}%`}
              />
              <StatCard
                icon={<IconTemperature size={16} />}
                label="Pressure"
                value={`${weather.current.pressure_hpa} hPa`}
              />
              {weather.current.sunrise && (
                <StatCard
                  icon={<IconSun size={16} />}
                  label="Sunrise"
                  value={formatUnixTime(weather.current.sunrise, "time")}
                />
              )}
              {weather.current.sunset && (
                <StatCard
                  icon={<IconSun size={16} />}
                  label="Sunset"
                  value={formatUnixTime(weather.current.sunset, "time")}
                />
              )}
            </SimpleGrid>
          </Card>

          {/* 5-day forecast */}
          {weather.daily.length > 0 && (
            <Box>
              <Text fw={600} mb="xs">5-Day Forecast</Text>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs">
                {weather.daily.map((day) => (
                  <DayCard key={day.date} day={day} />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Hourly chart */}
          {weather.hourly.length > 0 && (
            <Box>
              <Text fw={600} mb="xs">Next 24 Hours</Text>
              <Card withBorder p="sm">
                <ForecastChart hourly={weather.hourly} />
              </Card>
            </Box>
          )}

          <Text size="xs" c="dimmed">
            Last updated: {weather.fetched_at.replace("T", " ")}
          </Text>
        </>
      )}
    </Stack>
  );
}
