import { Box, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { IconCloud } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { WeatherData } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";

export function WeatherMiniWidget() {
  const navigate = useNavigate();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const { data: apiKey } = useQuery<string | null>({
    queryKey: ["weather-api-key"],
    queryFn: async () => {
      const res = await commands.getWeatherApiKey();
      if (res.status === "error") return null;
      return res.data ?? null;
    },
  });

  const { data: weather, isLoading } = useQuery<WeatherData | null>({
    queryKey: ["weather", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return null;
      const res = await commands.getWeather(activeEnvId);
      if (res.status === "error") return null;
      return res.data ?? null;
    },
    enabled: !!activeEnvId && !!apiKey,
    staleTime: 5 * 60 * 1000,
  });

  if (!activeEnvId || !apiKey) return null;

  return (
    <Card
      withBorder
      padding="sm"
      radius="sm"
      style={{ cursor: "pointer" }}
      onClick={() => navigate({ to: "/weather" })}
    >
      {isLoading ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">Loading weather…</Text>
        </Group>
      ) : weather ? (
        <Group gap="sm" justify="space-between">
          <Group gap="xs">
            {weather.current.icon ? (
              <img
                src={`https://openweathermap.org/img/wn/${weather.current.icon}.png`}
                alt={weather.current.description}
                style={{ width: 32, height: 32 }}
              />
            ) : (
              <Box c="blue"><IconCloud size={24} /></Box>
            )}
            <Stack gap={0}>
              <Text size="lg" fw={700} lh={1}>
                {Math.round(weather.current.temperature_c)}°C
              </Text>
              <Text size="xs" c="dimmed" style={{ textTransform: "capitalize" }}>
                {weather.current.description}
              </Text>
            </Stack>
          </Group>
          {weather.daily[0] && (
            <Stack gap={0} ta="right">
              <Text size="xs" c="orange">
                ↑ {Math.round(weather.daily[0].temp_max_c)}°
              </Text>
              <Text size="xs" c="dimmed">
                ↓ {Math.round(weather.daily[0].temp_min_c)}°
              </Text>
            </Stack>
          )}
        </Group>
      ) : (
        <Group gap="xs">
          <Box c="dimmed"><IconCloud size={16} /></Box>
          <Text size="sm" c="dimmed">Weather unavailable</Text>
        </Group>
      )}
    </Card>
  );
}
