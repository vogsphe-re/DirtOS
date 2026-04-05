/**
 * Dashboard widget components — Phase 14
 * Each widget receives `envId: number` and fetches its own data.
 */

import {
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  NumberInput,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCalendar,
  IconCloudRain,
  IconLeaf,
  IconNotebook,
  IconPlant2,
  IconSeeding,
  IconShovel,
  IconThermometer,
  IconWifi,
  IconX,
} from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { commands } from "../../lib/bindings";
import type {
  CalendarEvent,
  Harvest,
  Issue,
  JournalEntry,
  Recommendation,
  Sensor,
  SoilTest,
  WeatherData,
} from "../../lib/bindings";

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

function WidgetLoader() {
  return (
    <Box py="xl" ta="center">
      <Loader size="sm" />
    </Box>
  );
}

export function EmptyState({ msg }: { msg: string }) {
  return (
    <Text size="sm" c="dimmed" py="md" ta="center">
      {msg}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Plant Status Summary
// ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
  planned:   { color: "blue",   icon: <IconShovel size={14} /> },
  seedling:  { color: "teal",   icon: <IconSeeding size={14} /> },
  active:    { color: "green",  icon: <IconPlant2 size={14} /> },
  harvested: { color: "yellow", icon: <IconLeaf size={14} /> },
  removed:   { color: "gray",   icon: <IconX size={14} /> },
  dead:      { color: "red",    icon: <IconX size={14} /> },
};

export function PlantStatusWidget({ envId }: { envId: number }) {
  const { data: plants, isLoading } = useQuery({
    queryKey: ["plants-env", envId],
    queryFn: async () => {
      const res = await commands.listPlants(envId, 1000, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!plants?.length) return <EmptyState msg="No plants in this environment." />;

  const counts = plants.reduce<Record<string, number>>((acc, p) => {
    const k = (p.status as string).toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Stack gap="xs">
      {Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => {
          const meta = STATUS_META[status] ?? { color: "gray", icon: <IconLeaf size={14} /> };
          return (
            <Group key={status} justify="space-between">
              <Group gap={6}>
                <ThemeIcon size="xs" color={meta.color} variant="light">
                  {meta.icon}
                </ThemeIcon>
                <Text size="sm" tt="capitalize">{status}</Text>
              </Group>
              <Badge color={meta.color} variant="light" size="sm">{count}</Badge>
            </Group>
          );
        })}
      <Text size="xs" c="dimmed" ta="right" mt={4}>
        {plants.length} total
      </Text>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Open Issues
// ─────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "gray",
};

export function OpenIssuesWidget({ envId }: { envId: number }) {
  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ["issues-open", envId],
    queryFn: async () => {
      const res = await commands.listIssues(envId, 50, 0);
      if (res.status === "error") throw new Error(res.error);
      return (res.data as Issue[]).filter((i) => i.status !== "closed");
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!issues.length) return <EmptyState msg="No open issues." />;

  return (
    <Stack gap="xs">
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={600}>{issues.length} open</Text>
      </Group>
      {issues.slice(0, 5).map((issue) => (
        <Group key={issue.id} justify="space-between" wrap="nowrap">
          <Text size="xs" truncate="end" maw={280}>{issue.title}</Text>
          <Badge
            size="xs"
            color={PRIORITY_COLORS[issue.priority] ?? "gray"}
            variant="light"
            style={{ flexShrink: 0 }}
          >
            {issue.priority}
          </Badge>
        </Group>
      ))}
      {issues.length > 5 && (
        <Text size="xs" c="dimmed" ta="right">+{issues.length - 5} more</Text>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Upcoming Schedules
// ─────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  Schedule: "blue",
  PlantingDate: "green",
  HarvestDate: "yellow",
  IssueCreated: "red",
};

export function UpcomingSchedulesWidget({ envId }: { envId: number }) {
  const todayRef = useRef(new Date().toISOString().slice(0, 10));
  const nextWeekRef = useRef(
    new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  );
  const today = todayRef.current;
  const nextWeek = nextWeekRef.current;

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", envId, today, nextWeek],
    queryFn: async () => {
      const res = await commands.getCalendarEvents(envId, today, nextWeek);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!events.length) return <EmptyState msg="No upcoming tasks this week." />;

  return (
    <Stack gap="xs">
      {events.slice(0, 8).map((ev) => (
        <Group key={ev.id} justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <IconCalendar size={12} style={{ flexShrink: 0 }} />
            <Text size="xs" truncate="end">{ev.title}</Text>
          </Group>
          <Group gap={4} style={{ flexShrink: 0 }}>
            <Badge
              size="xs"
              color={EVENT_COLORS[ev.event_type] ?? "gray"}
              variant="light"
            >
              {ev.date}
            </Badge>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Weather
// ─────────────────────────────────────────────────────────────

export function WeatherWidget({ envId }: { envId: number }) {
  const { data: weather, isLoading } = useQuery<WeatherData | null>({
    queryKey: ["weather", envId],
    queryFn: async () => {
      const res = await commands.getWeather(envId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!weather) return <EmptyState msg="No weather data. Configure API key in Settings." />;

  const c = weather.current;
  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end">
        <Text size="xl" fw={700}>{c.temperature_c.toFixed(1)}°C</Text>
        <Text size="sm" c="dimmed">{c.description}</Text>
      </Group>
      <Group gap="md">
        <Group gap={4}>
          <IconThermometer size={14} />
          <Text size="xs">Feels {c.feels_like_c.toFixed(1)}°C</Text>
        </Group>
        <Group gap={4}>
          <IconCloudRain size={14} />
          <Text size="xs">{c.humidity}% humidity</Text>
        </Group>
      </Group>
      {weather.daily.length > 0 && (
        <Group gap="xs" mt={4}>
          {weather.daily.slice(0, 4).map((d, i) => (
            <Card key={i} p={6} withBorder radius="sm" style={{ minWidth: 60, textAlign: "center" }}>
              <Text size="xs" c="dimmed">{d.date.slice(5)}</Text>
              <Text size="xs" fw={600}>{d.temp_max_c.toFixed(0)}°</Text>
              <Text size="xs" c="dimmed">{d.temp_min_c.toFixed(0)}°</Text>
            </Card>
          ))}
        </Group>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Sensor Readings
// ─────────────────────────────────────────────────────────────

export function SensorReadingsWidget({ envId }: { envId: number }) {
  const { data: sensors = [], isLoading: loadingSensors } = useQuery<Sensor[]>({
    queryKey: ["sensors", envId],
    queryFn: async () => {
      const res = await commands.listSensors(envId, 10, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const readingQueries = useQueries({
    queries: sensors.slice(0, 8).map((sensor) => ({
      queryKey: ["latest-reading", sensor.id],
      queryFn: async () => {
        const res = await commands.getLatestReading(sensor.id);
        if (res.status === "error") return null;
        return res.data;
      },
    })),
  });

  if (loadingSensors) return <WidgetLoader />;
  if (!sensors.length) return <EmptyState msg="No sensors configured." />;

  return (
    <Stack gap="xs">
      {sensors.slice(0, 8).map((sensor, i) => {
        const reading = readingQueries[i]?.data;
        return (
          <Group key={sensor.id} justify="space-between">
            <Group gap={6}>
              <IconWifi size={12} />
              <Text size="xs" truncate="end" maw={200}>{sensor.name}</Text>
            </Group>
            <Text size="xs" fw={600}>
              {reading
                ? `${reading.value} ${reading.unit ?? ""}`
                : "—"}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Soil Health
// ─────────────────────────────────────────────────────────────

export function SoilHealthWidget({ envId }: { envId: number }) {
  // Fetch locations first, then soil tests for the first few
  const { data: locations = [], isLoading: loadingLocs } = useQuery({
    queryKey: ["locations", envId],
    queryFn: async () => {
      const res = await commands.listLocations(envId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const soilQueries = useQueries({
    queries: locations.slice(0, 4).map((loc) => ({
      queryKey: ["soil-tests", loc.id],
      queryFn: async () => {
        const res = await commands.listSoilTests(loc.id);
        if (res.status === "error") return [] as SoilTest[];
        return res.data as SoilTest[];
      },
    })),
  });

  if (loadingLocs) return <WidgetLoader />;

  const entries = locations.slice(0, 4).map((loc, i) => {
    const tests = soilQueries[i]?.data ?? [];
    const latest = tests[0];
    return { loc, latest };
  }).filter((e) => e.latest);

  if (!entries.length) return <EmptyState msg="No soil tests recorded." />;

  return (
    <Stack gap="xs">
      {entries.map(({ loc, latest }) => (
        <Group key={loc.id} justify="space-between">
          <Text size="xs" truncate="end" maw={180}>{loc.name}</Text>
          <Group gap={6}>
            {latest!.ph != null && (
              <Badge size="xs" color={phColor(latest!.ph)} variant="light">
                pH {latest!.ph.toFixed(1)}
              </Badge>
            )}
            {latest!.moisture_pct != null && (
              <Badge size="xs" color="blue" variant="light">
                {latest!.moisture_pct.toFixed(0)}% H₂O
              </Badge>
            )}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

function phColor(ph: number) {
  if (ph < 5.5) return "orange";
  if (ph > 7.5) return "orange";
  return "green";
}

// ─────────────────────────────────────────────────────────────
// 7. Recent Harvests
// ─────────────────────────────────────────────────────────────

export function RecentHarvestsWidget({ envId }: { envId: number }) {
  const { data: harvests = [], isLoading } = useQuery<Harvest[]>({
    queryKey: ["harvests-recent", envId],
    queryFn: async () => {
      const res = await commands.listAllHarvests(envId, null, null, 5, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!harvests.length) return <EmptyState msg="No harvests recorded yet." />;

  return (
    <Stack gap="xs">
      {harvests.map((h) => (
        <Group key={h.id} justify="space-between">
          <Group gap={6}>
            <IconLeaf size={12} />
            <Text size="xs">{h.harvest_date}</Text>
          </Group>
          <Text size="xs" fw={600}>
            {h.quantity != null ? `${h.quantity} ${h.unit ?? ""}` : "—"}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. Recommendations
// ─────────────────────────────────────────────────────────────

const REC_COLORS: Record<string, string> = {
  yield: "orange",
  health: "red",
  soil: "blue",
  harvest: "green",
};

export function RecommendationsWidget({ envId }: { envId: number }) {
  const { data: recs = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ["recommendations", envId],
    queryFn: async () => {
      const res = await commands.getRecommendations(envId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!recs.length)
    return <EmptyState msg="No recommendations — your garden looks great!" />;

  return (
    <Stack gap="xs">
      {recs.slice(0, 4).map((rec, i) => (
        <Box key={i} p="xs" style={{ borderRadius: 6, background: "var(--mantine-color-default-hover)" }}>
          <Group justify="space-between" mb={2}>
            <Badge size="xs" color={REC_COLORS[rec.category] ?? "gray"} variant="light">
              {rec.category}
            </Badge>
            <Text size="xs" c="dimmed">{Math.round(rec.confidence * 100)}%</Text>
          </Group>
          <Text size="xs" fw={500}>{rec.title}</Text>
        </Box>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. Recent Journal
// ─────────────────────────────────────────────────────────────

export function RecentJournalWidget({ envId }: { envId: number }) {
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal-recent", envId],
    queryFn: async () => {
      const res = await commands.listJournalEntries(envId, null, 5, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) return <WidgetLoader />;
  if (!entries.length) return <EmptyState msg="No journal entries yet." />;

  return (
    <Stack gap="xs">
      {entries.map((e) => (
        <Group key={e.id} justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap={6} wrap="nowrap">
            <IconNotebook size={12} style={{ flexShrink: 0, marginTop: 3 }} />
            <Text size="xs" lineClamp={2}>{e.title}</Text>
          </Group>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {e.created_at.slice(0, 10)}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. Home Assistant iframe embed
// ─────────────────────────────────────────────────────────────

export function HaIframeWidget({ config }: { config: Record<string, unknown> }) {
  const url = typeof config.url === "string" ? config.url.trim() : "";
  const height = typeof config.height === "number" ? config.height : 500;

  if (!url) {
    return (
      <Box py="xl" ta="center">
        <Text size="sm" c="dimmed">
          No URL configured. Edit this widget and enter a Home Assistant dashboard URL.
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ width: "100%", height }}>
      <iframe
        src={url}
        title="Home Assistant"
        style={{ width: "100%", height: "100%", border: "none", borderRadius: 4 }}
        allow="fullscreen"
        loading="lazy"
      />
    </Box>
  );
}

