import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconLeaf, IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { JournalEntry, Plant } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { JournalForm } from "./JournalForm";

const WEATHER_ICONS: Record<string, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  windy: "💨",
  snowy: "❄️",
  foggy: "🌫️",
  overcast: "🌥️",
};

function parseConditions(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function ConditionsBadges({ conditionsJson }: { conditionsJson: string | null }) {
  const c = parseConditions(conditionsJson);
  return (
    <Group gap={4}>
      {!!c.weather && (
        <Badge variant="light" size="xs" color="blue">
          {WEATHER_ICONS[c.weather as string] ?? ""} {String(c.weather)}
        </Badge>
      )}
      {!!c.plant_health && (
        <Badge
          variant="light"
          size="xs"
          color={
            c.plant_health === "healthy"
              ? "green"
              : c.plant_health === "fair"
              ? "yellow"
              : c.plant_health === "poor"
              ? "orange"
              : "red"
          }
        >
          {String(c.plant_health)}
        </Badge>
      )}
      {c.temperature_c != null && (
        <Badge variant="outline" size="xs" color="gray">
          {String(c.temperature_c)}°C
        </Badge>
      )}
    </Group>
  );
}

interface EntryCardProps {
  entry: JournalEntry;
  plant: Plant | undefined;
  onClick: () => void;
}

function EntryCard({ entry, plant, onClick }: EntryCardProps) {
  return (
    <Box
      p="md"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 8,
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Text fw={600} size="sm" lineClamp={1}>
          {entry.title}
        </Text>
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {new Date(entry.created_at).toLocaleDateString()}
        </Text>
      </Group>

      {plant && (
        <Group gap={4} mb={4}>
          <IconLeaf size={12} />
          <Text size="xs" c="dimmed">
            {plant.name}
          </Text>
        </Group>
      )}

      {entry.body && (
        <Text size="xs" c="dimmed" lineClamp={2} mb={4}>
          {entry.body}
        </Text>
      )}

      <ConditionsBadges conditionsJson={entry.conditions_json} />
    </Box>
  );
}

export function JournalList() {
  const navigate = useNavigate();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal-entries", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listJournalEntries(activeEnvId, null, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const plantById = useMemo(() => {
    const m: Record<number, Plant> = {};
    for (const p of plants) m[p.id] = p;
    return m;
  }, [plants]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (plantFilter && String(e.plant_id) !== plantFilter) return false;
      if (dateFrom && new Date(e.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        if (new Date(e.created_at) > end) return false;
      }
      return true;
    });
  }, [entries, search, plantFilter, dateFrom, dateTo]);

  const plantOptions = plants.map((p) => ({ value: String(p.id), label: p.name }));

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Journal</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Entry
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: "1 1 140px", minWidth: 140 }}
        />
        <Select
          placeholder="All plants"
          data={[{ value: "", label: "All plants" }, ...plantOptions]}
          value={plantFilter ?? ""}
          onChange={(v) => setPlantFilter(v || null)}
          clearable
          searchable
          style={{ minWidth: 180 }}
        />
        <DatePickerInput
          placeholder="From date"
          value={dateFrom}
          onChange={setDateFrom}
          clearable
          style={{ minWidth: 140 }}
        />
        <DatePickerInput
          placeholder="To date"
          value={dateTo}
          onChange={setDateTo}
          clearable
          style={{ minWidth: 140 }}
        />
      </Group>

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : filtered.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {entries.length === 0 ? "No journal entries yet." : "No entries match the filters."}
        </Text>
      ) : (
        <Stack gap="sm">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              plant={entry.plant_id ? plantById[entry.plant_id] : undefined}
              onClick={() =>
                navigate({
                  to: "/journal/$entryId",
                  params: { entryId: String(entry.id) },
                })
              }
            />
          ))}
        </Stack>
      )}

      {!activeEnvId && (
        <Text c="dimmed" ta="center">
          Select an environment to view journal entries.
        </Text>
      )}

      <JournalForm opened={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}
