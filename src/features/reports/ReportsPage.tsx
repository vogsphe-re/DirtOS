import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconChartBar,
  IconLeaf,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { commands } from "../../lib/bindings";
import type {
  NewSeason,
  Recommendation,
  ReportData,
  Season,
} from "../../lib/bindings";
import { useEnvironmentStore } from "../../stores/environmentStore";

const PIE_COLORS = [
  "#4caf50", "#2196f3", "#ff9800", "#e91e63",
  "#9c27b0", "#00bcd4", "#8bc34a", "#ff5722",
];

export function ReportsPage() {
  const environment = useEnvironmentStore((s) => s.environment);
  const envId = environment?.id ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo] = useState(today);
  const [reportType, setReportType] = useState("harvest_by_species");

  const { data: reportData, isLoading: loadingReport } = useQuery<ReportData | null>({
    queryKey: ["report", envId, reportType, dateFrom, dateTo],
    queryFn: async () => {
      if (!envId) return null;
      const res = await commands.getReportData(
        envId,
        reportType,
        dateFrom || null,
        dateTo || null,
        null,
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data as ReportData;
    },
    enabled: !!envId,
  });

  const { data: recommendations = [], isLoading: loadingRecs } = useQuery<Recommendation[]>({
    queryKey: ["recommendations", envId],
    queryFn: async () => {
      if (!envId) return [];
      const res = await commands.getRecommendations(envId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Recommendation[];
    },
    enabled: !!envId,
  });

  const { data: seasons = [], isLoading: loadingSeasons } = useQuery<Season[]>({
    queryKey: ["seasons", envId],
    queryFn: async () => {
      if (!envId) return [];
      const res = await commands.listSeasons(envId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Season[];
    },
    enabled: !!envId,
  });

  if (!envId) {
    return (
      <Stack p="md" align="center">
        <Text c="dimmed">No active environment selected.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Reports & Analytics</Title>
      </Group>

      <Tabs defaultValue="charts">
        <Tabs.List>
          <Tabs.Tab value="charts" leftSection={<IconChartBar size={14} />}>
            Charts
          </Tabs.Tab>
          <Tabs.Tab value="recommendations" leftSection={<IconAlertTriangle size={14} />}>
            Recommendations
            {recommendations.length > 0 && (
              <Badge size="xs" ml="xs" color="orange">{recommendations.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="seasons" leftSection={<IconLeaf size={14} />}>
            Seasons
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Charts tab ──────────────────────────────────────────────────── */}
        <Tabs.Panel value="charts" pt="md">
          <Stack gap="md">
            <Group>
              <Select
                label="Report type"
                value={reportType}
                onChange={(v) => setReportType(v ?? "harvest_by_species")}
                data={[
                  { value: "harvest_by_species", label: "Harvest yield by species" },
                  { value: "harvest_by_month", label: "Harvest yield by month" },
                  { value: "issues_by_label", label: "Issues by label" },
                  { value: "soil_ph_trend", label: "Soil pH trend" },
                ]}
                w={260}
              />
              <TextInput
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.currentTarget.value)}
                w={160}
              />
              <TextInput
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.currentTarget.value)}
                w={160}
              />
            </Group>

            {loadingReport ? (
              <Loader />
            ) : reportData && reportData.points.length > 0 ? (
              <Card withBorder p="md">
                <ChartView data={reportData} />
              </Card>
            ) : (
              <Text c="dimmed" py="xl" ta="center">
                No data for the selected range.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Recommendations tab ──────────────────────────────────────────── */}
        <Tabs.Panel value="recommendations" pt="md">
          {loadingRecs ? (
            <Loader />
          ) : recommendations.length === 0 ? (
            <Text c="dimmed" py="xl" ta="center">
              No recommendations at this time. Keep up the good work!
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* ── Seasons tab ─────────────────────────────────────────────────── */}
        <Tabs.Panel value="seasons" pt="md">
          <SeasonsPanel environmentId={envId} seasons={seasons} isLoading={loadingSeasons} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ── Chart selector ──────────────────────────────────────────────────────────

function ChartView({ data }: { data: ReportData }) {
  const points = data.points.map((p) => ({ name: p.label, value: p.value, secondary: p.secondary }));

  if (data.report_type === "issues_by_label") {
    return (
      <Stack gap="sm">
        <Text fw={600} mb="xs">Issues by label</Text>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={points}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {points.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Stack>
    );
  }

  if (data.report_type === "soil_ph_trend") {
    return (
      <Stack gap="sm">
        <Text fw={600} mb="xs">
          Soil pH trend {data.date_from} → {data.date_to}
        </Text>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[4, 9]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" name="pH" stroke="#4caf50" dot />
          </LineChart>
        </ResponsiveContainer>
      </Stack>
    );
  }

  // Default: bar chart (harvest_by_species / harvest_by_month)
  const title =
    data.report_type === "harvest_by_month"
      ? "Harvest yield by month"
      : "Harvest yield by species";

  return (
    <Stack gap="sm">
      <Text fw={600} mb="xs">
        {title} {data.unit ? `(${data.unit})` : ""}
      </Text>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={points} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" name={data.unit ?? "quantity"} fill="#4caf50" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Stack>
  );
}

// ── Recommendation card ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  yield: "orange",
  health: "red",
  soil: "blue",
  harvest: "green",
};

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const color = CATEGORY_COLORS[rec.category] ?? "gray";
  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="xs">
        <Badge color={color} variant="light" tt="capitalize">
          {rec.category}
        </Badge>
        <Text size="xs" c="dimmed">
          {Math.round(rec.confidence * 100)}% confidence
        </Text>
      </Group>
      <Text fw={600} mb={4}>{rec.title}</Text>
      <Text size="sm" c="dimmed" mb="sm">{rec.description}</Text>
      {rec.action_suggestion && (
        <>
          <Divider mb="xs" />
          <Text size="xs" fw={500}>Suggested action: {rec.action_suggestion}</Text>
        </>
      )}
      <Progress
        value={rec.confidence * 100}
        color={color}
        size="xs"
        mt="sm"
        radius="xl"
      />
    </Card>
  );
}

// ── Seasons panel ───────────────────────────────────────────────────────────

function SeasonsPanel({
  environmentId,
  seasons,
  isLoading,
}: {
  environmentId: number;
  seasons: Season[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<{
    name: string;
    start_date: string;
    end_date: string;
    notes: string;
  }>({
    name: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const createSeason = useMutation({
    mutationFn: async () => {
      if (!values.name || !values.start_date || !values.end_date) {
        throw new Error("Name, start date and end date are required.");
      }
      const input: NewSeason = {
        environment_id: environmentId,
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        notes: values.notes.trim() || null,
      };
      const res = await commands.createSeason(input);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", environmentId] });
      notifications.show({ message: "Season created.", color: "green" });
      setValues({ name: "", start_date: "", end_date: "", notes: "" });
      setShowForm(false);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deleteSeason = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteSeason(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", environmentId] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const f = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.currentTarget.value })),
  });

  return (
    <Stack gap="md">
      <Group>
        <Button
          leftSection={<IconPlus size={14} />}
          size="xs"
          variant="light"
          onClick={() => setShowForm((v) => !v)}
        >
          New season
        </Button>
      </Group>

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="sm">
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label="Season name" required {...f("name")} />
              <TextInput label="Notes" {...f("notes")} />
              <TextInput label="Start date" type="date" required {...f("start_date")} />
              <TextInput label="End date" type="date" required {...f("end_date")} />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button size="xs" onClick={() => createSeason.mutate()} loading={createSeason.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Loader />
      ) : seasons.length === 0 ? (
        <Text c="dimmed" py="xl" ta="center">No seasons defined yet.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Start</Table.Th>
              <Table.Th>End</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {seasons.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td fw={500}>{s.name}</Table.Td>
                <Table.Td>{s.start_date}</Table.Td>
                <Table.Td>{s.end_date}</Table.Td>
                <Table.Td>{s.notes ?? "—"}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    loading={deleteSeason.isPending}
                    leftSection={<IconTrash size={12} />}
                    onClick={() => {
                      if (confirm(`Delete season "${s.name}"?`)) deleteSeason.mutate(s.id);
                    }}
                  >
                    Delete
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
