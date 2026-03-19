import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Plant, Schedule, ScheduleType } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { ScheduleForm } from "./ScheduleForm";

const TYPE_COLORS: Record<ScheduleType, string> = {
  water: "blue",
  feed: "orange",
  maintenance: "violet",
  treatment: "red",
  sample: "teal",
  custom: "gray",
};

const TYPE_LABELS: Record<ScheduleType, string> = {
  water: "💧 Water",
  feed: "🌱 Feed",
  maintenance: "🔧 Maintenance",
  treatment: "💊 Treatment",
  sample: "🔬 Sample",
  custom: "⚙️ Custom",
};

const SCHEDULE_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "water", label: "💧 Water" },
  { value: "feed", label: "🌱 Feed" },
  { value: "maintenance", label: "🔧 Maintenance" },
  { value: "treatment", label: "💊 Treatment" },
  { value: "sample", label: "🔬 Sample" },
  { value: "custom", label: "⚙️ Custom" },
];

export function ScheduleList() {
  const qc = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listSchedules(activeEnvId);
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
    return schedules.filter((s) => {
      if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && s.schedule_type !== typeFilter) return false;
      return true;
    });
  }, [schedules, search, typeFilter]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await commands.toggleSchedule(id, active);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteSchedule(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      notifications.show({ message: "Schedule deleted.", color: "orange" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  function formatNextRun(next_run_at: string | null) {
    if (!next_run_at) return <Text size="xs" c="dimmed">—</Text>;
    const d = new Date(next_run_at);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return <Text size="xs" c="red">Overdue</Text>;
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return <Text size="xs">{hours}h</Text>;
    return <Text size="xs">{d.toLocaleDateString()}</Text>;
  }

  return (
    <>
      <Stack p="md" gap="md">
        <Group justify="space-between">
          <Title order={2}>Schedules</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            New Schedule
          </Button>
        </Group>

        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search…"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: "1 1 140px", minWidth: 140 }}
          />
          <Select
            placeholder="All types"
            data={SCHEDULE_TYPE_OPTIONS}
            value={typeFilter ?? ""}
            onChange={(v) => setTypeFilter(v || null)}
            clearable
            style={{ minWidth: 160 }}
          />
        </Group>

        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : filtered.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {schedules.length === 0 ? "No schedules yet." : "No schedules match filters."}
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Plant</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Next run</Table.Th>
                <Table.Th>Active</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Badge size="sm" color={TYPE_COLORS[s.schedule_type]} variant="light">
                      {TYPE_LABELS[s.schedule_type]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {s.title}
                    </Text>
                    {s.notes && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {s.notes}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {s.plant_id ? (plantById[s.plant_id]?.name ?? `#${s.plant_id}`) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" c="dimmed">
                      {s.cron_expression ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatNextRun(s.next_run_at)}</Table.Td>
                  <Table.Td>
                    <Switch
                      size="xs"
                      checked={s.is_active}
                      onChange={(e) =>
                        toggleMutation.mutate({ id: s.id, active: e.currentTarget.checked })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <Tooltip label="Edit">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setEditing(s)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => deleteMutation.mutate(s.id)}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {!activeEnvId && (
          <Text c="dimmed" ta="center">
            Select an environment to view schedules.
          </Text>
        )}
      </Stack>

      <ScheduleForm opened={createOpen} onClose={() => setCreateOpen(false)} />
      <ScheduleForm
        opened={!!editing}
        onClose={() => setEditing(null)}
        editing={editing}
      />
    </>
  );
}
