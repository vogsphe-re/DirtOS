import {
  Button,
  Grid,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { commands } from "../../lib/bindings";
import type { Location, NewSoilTest, SoilTest } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";

const METRIC_KEYS: { key: keyof SoilTest; label: string; color: string }[] = [
  { key: "ph", label: "pH", color: "#d3869b" },
  { key: "moisture_pct", label: "Moisture %", color: "#83a598" },
  { key: "organic_matter_pct", label: "Organic Matter %", color: "#b8bb26" },
  { key: "nitrogen_ppm", label: "Nitrogen (ppm)", color: "#fabd2f" },
  { key: "phosphorus_ppm", label: "Phosphorus (ppm)", color: "#fb4934" },
  { key: "potassium_ppm", label: "Potassium (ppm)", color: "#fe8019" },
];

export function SoilTests() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [ph, setPh] = useState<number | string>("");
  const [nitrogenPpm, setNitrogenPpm] = useState<number | string>("");
  const [phosphorusPpm, setPhosphorusPpm] = useState<number | string>("");
  const [potassiumPpm, setPotassiumPpm] = useState<number | string>("");
  const [moisturePct, setMoisturePct] = useState<number | string>("");
  const [organicMatterPct, setOrganicMatterPct] = useState<number | string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listLocations(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const locationOptions = locations.map((l) => ({
    value: String(l.id),
    label: l.name,
  }));

  const { data: soilTests = [], isLoading } = useQuery<SoilTest[]>({
    queryKey: ["soil-tests", selectedLocationId],
    queryFn: async () => {
      if (!selectedLocationId) return [];
      const res = await commands.listSoilTests(Number(selectedLocationId));
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!selectedLocationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteSoilTest(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["soil-tests", selectedLocationId] }),
  });

  const handleSubmit = async () => {
    if (!selectedLocationId) {
      setError("Select a location first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: NewSoilTest = {
        location_id: Number(selectedLocationId),
        test_date: testDate,
        ph: ph !== "" ? Number(ph) : null,
        nitrogen_ppm: nitrogenPpm !== "" ? Number(nitrogenPpm) : null,
        phosphorus_ppm: phosphorusPpm !== "" ? Number(phosphorusPpm) : null,
        potassium_ppm: potassiumPpm !== "" ? Number(potassiumPpm) : null,
        moisture_pct: moisturePct !== "" ? Number(moisturePct) : null,
        organic_matter_pct: organicMatterPct !== "" ? Number(organicMatterPct) : null,
        notes: notes || null,
      };
      const res = await commands.createSoilTest(input);
      if (res.status === "error") throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["soil-tests", selectedLocationId] });
      setShowForm(false);
      // Reset form
      setPh(""); setNitrogenPpm(""); setPhosphorusPpm(""); setPotassiumPpm("");
      setMoisturePct(""); setOrganicMatterPct(""); setNotes("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = soilTests
    .slice()
    .reverse()
    .map((t) => ({ date: t.test_date, ...t }));

  return (
    <Stack p="md">
      <Group justify="space-between">
        <Title order={3}>Soil Tests</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowForm((v) => !v)}
          variant={showForm ? "filled" : "light"}
        >
          {showForm ? "Cancel" : "Log Test"}
        </Button>
      </Group>

      <Select
        label="Location"
        placeholder="Select a location"
        data={locationOptions}
        value={selectedLocationId}
        onChange={setSelectedLocationId}
        clearable
      />

      {showForm && (
        <Stack
          p="md"
          style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}
        >
          <Title order={5}>New Soil Test</Title>
          <Grid>
            <Grid.Col span={4}>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.currentTarget.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--mantine-color-default-border)",
                  width: "100%",
                }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="pH"
                placeholder="6.5"
                value={ph}
                onChange={setPh}
                min={0}
                max={14}
                step={0.1}
                decimalScale={1}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Moisture %"
                value={moisturePct}
                onChange={setMoisturePct}
                min={0}
                max={100}
                step={0.1}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Nitrogen (ppm)"
                value={nitrogenPpm}
                onChange={setNitrogenPpm}
                min={0}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Phosphorus (ppm)"
                value={phosphorusPpm}
                onChange={setPhosphorusPpm}
                min={0}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Potassium (ppm)"
                value={potassiumPpm}
                onChange={setPotassiumPpm}
                min={0}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Organic Matter %"
                value={organicMatterPct}
                onChange={setOrganicMatterPct}
                min={0}
                max={100}
                step={0.1}
              />
            </Grid.Col>
            <Grid.Col span={8}>
              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                rows={2}
              />
            </Grid.Col>
          </Grid>
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end">
            <Button onClick={handleSubmit} loading={submitting}>
              Save Test
            </Button>
          </Group>
        </Stack>
      )}

      {isLoading ? (
        <Loader />
      ) : !selectedLocationId ? (
        <Text c="dimmed">Select a location to view its soil tests.</Text>
      ) : soilTests.length === 0 ? (
        <Text c="dimmed">No soil tests recorded for this location.</Text>
      ) : (
        <>
          {chartData.length > 1 && (
            <Stack>
              <Text fw={500} size="sm">
                Trend over time
              </Text>
              <Grid>
                {METRIC_KEYS.filter((m) =>
                  chartData.some((d) => d[m.key] !== null && d[m.key] !== undefined)
                ).map(({ key, label, color }) => (
                  <Grid.Col key={String(key)} span={{ base: 12, sm: 6 }}>
                    <Text size="xs" c="dimmed" mb={4}>
                      {label}
                    </Text>
                    <div style={{ height: 100 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} width={32} />
                          <Tooltip
                          formatter={(v: unknown) => [Number(v).toFixed(2), label]}
                          />
                          <Line
                            type="monotone"
                            dataKey={String(key)}
                            stroke={color}
                            dot
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Grid.Col>
                ))}
              </Grid>
            </Stack>
          )}

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>pH</Table.Th>
                <Table.Th>N (ppm)</Table.Th>
                <Table.Th>P (ppm)</Table.Th>
                <Table.Th>K (ppm)</Table.Th>
                <Table.Th>Moisture %</Table.Th>
                <Table.Th>OM %</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {soilTests.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Text size="sm">{t.test_date}</Text>
                  </Table.Td>
                  <Table.Td>{t.ph?.toFixed(1) ?? "—"}</Table.Td>
                  <Table.Td>{t.nitrogen_ppm?.toFixed(0) ?? "—"}</Table.Td>
                  <Table.Td>{t.phosphorus_ppm?.toFixed(0) ?? "—"}</Table.Td>
                  <Table.Td>{t.potassium_ppm?.toFixed(0) ?? "—"}</Table.Td>
                  <Table.Td>{t.moisture_pct?.toFixed(1) ?? "—"}</Table.Td>
                  <Table.Td>{t.organic_matter_pct?.toFixed(1) ?? "—"}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {t.notes ?? ""}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        if (confirm("Delete this soil test?")) {
                          deleteMutation.mutate(t.id);
                        }
                      }}
                    >
                      <IconTrash size={12} />
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}
