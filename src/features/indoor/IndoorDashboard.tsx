import { Alert, Badge, Button, Card, Grid, Group, Modal, Select, Stack, Table, Tabs, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Plant, Species } from "../plants/types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "../plants/types";
import { HydroponicsPanel } from "./HydroponicsPanel";
import { IndoorCanvasTools } from "./IndoorCanvasTools";
import { IndoorReadings } from "./IndoorReadings";
import { LightSchedule } from "./LightSchedule";
import { VentilationPanel } from "./VentilationPanel";

dayjs.extend(relativeTime);

type Props = {
  indoorEnvId: number;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={2}>
        <Text c="dimmed" size="sm">
          {label}
        </Text>
        <Text fw={700} size="xl">
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

export function IndoorDashboard({ indoorEnvId }: Props) {
  const summaryQuery = useQuery({
    queryKey: ["indoor-dashboard", indoorEnvId],
    queryFn: async () => {
      const res = await commands.getIndoorDashboardSummary(indoorEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (summaryQuery.isError) {
    return (
      <Alert color="red" title="Failed to load indoor dashboard">
        {String(summaryQuery.error)}
      </Alert>
    );
  }

  if (!summaryQuery.data) {
    return <Text c="dimmed">Loading indoor dashboard...</Text>;
  }

  const summary = summaryQuery.data;
  const reading = summary.latest_reading;
  const environmentId = summary.location.environment_id;
  const locationId = summary.location.id;

  return (
    <Tabs defaultValue="overview">
      <Tabs.List mb="md">
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="plants">Plants</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview">
        <Stack>
      <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Current VPD"
              value={reading?.vpd !== null && reading?.vpd !== undefined ? `${reading.vpd.toFixed(2)} kPa` : "-"}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Air Temperature"
              value={reading?.air_temp !== null && reading?.air_temp !== undefined ? `${reading.air_temp.toFixed(1)} C` : "-"}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Water pH"
              value={reading?.water_ph !== null && reading?.water_ph !== undefined ? `${reading.water_ph.toFixed(2)}` : "-"}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Days Since Water Change"
              value={
                summary.reservoir_status.days_since_water_change !== null
                  ? `${summary.reservoir_status.days_since_water_change}`
                  : "-"
              }
            />
          </Grid.Col>
      </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <IndoorReadings indoorEnvId={indoorEnvId} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack>
              <LightSchedule
                environment={summary.indoor_environment}
                environmentId={environmentId}
                locationId={locationId}
            />
              <VentilationPanel summary={summary} />
            </Stack>
          </Grid.Col>
        </Grid>

        <HydroponicsPanel
          indoorEnvId={indoorEnvId}
          environmentId={environmentId}
          locationId={locationId}
        />

        <Card withBorder radius="md" p="md">
          <Stack>
            <Group justify="space-between">
              <Text fw={600}>Recent Issues</Text>
              <Text c="dimmed" size="sm">
                {summary.recent_issues.length} linked
              </Text>
            </Group>
            {summary.recent_issues.length === 0 ? (
              <Text c="dimmed" size="sm">
                No recent indoor issues.
              </Text>
            ) : (
              summary.recent_issues.slice(0, 5).map((issue) => (
                <Group justify="space-between" key={issue.id}>
                  <Text size="sm">{issue.title}</Text>
                  <Text c="dimmed" size="xs">
                    {dayjs(issue.created_at).fromNow()}
                  </Text>
                </Group>
              ))
            )}
          </Stack>
        </Card>

        <IndoorCanvasTools
          locationId={locationId}
          widthCm={summary.indoor_environment.tent_width}
          depthCm={summary.indoor_environment.tent_depth}
          lightWattage={summary.indoor_environment.light_wattage}
        />
      </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="plants">
        <IndoorPlantsTab environmentId={environmentId} locationId={locationId} />
      </Tabs.Panel>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Plants tab
// ---------------------------------------------------------------------------

function IndoorPlantsTab({
  environmentId,
  locationId,
}: {
  environmentId: number;
  locationId: number;
}) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("planned");

  const plantsQuery = useQuery({
    queryKey: ["plants-by-location", locationId],
    queryFn: async () => {
      const res = await commands.listPlantsByLocation(locationId, 200, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
  });

  const speciesQuery = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const res = await commands.listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
    enabled: addOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Plant name is required");
      const res = await commands.createPlant({
        species_id: speciesId ? parseInt(speciesId) : null,
        location_id: locationId,
        environment_id: environmentId,
        status: status as Plant["status"],
        name: name.trim(),
        label: null,
        planted_date: null,
        notes: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants-by-location", locationId] });
      notifications.show({ message: "Plant added to environment.", color: "green" });
      setName(""); setSpeciesId(null); setStatus("planned"); setAddOpen(false);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const plants = plantsQuery.data ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Plants in this space</Text>
        <Button size="xs" onClick={() => setAddOpen(true)}>Add Plant</Button>
      </Group>

      {plantsQuery.isLoading ? (
        <Text c="dimmed" size="sm">Loading...</Text>
      ) : plants.length === 0 ? (
        <Text c="dimmed" size="sm">No plants assigned to this space yet.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Planted</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {plants.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>
                  <Badge color={PLANT_STATUS_COLORS[p.status]} variant="light" size="xs">
                    {PLANT_STATUS_LABELS[p.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">{p.planted_date ?? "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Add plant to space">
        <Stack gap="sm">
          <TextInput
            label="Plant name"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. Basil #1"
          />
          <Select
            label="Species (optional)"
            searchable
            clearable
            data={(speciesQuery.data ?? []).map((sp) => ({
              value: String(sp.id),
              label: sp.common_name + (sp.scientific_name ? ` (${sp.scientific_name})` : ""),
            }))}
            value={speciesId}
            onChange={setSpeciesId}
          />
          <Select
            label="Status"
            data={[
              { value: "planned", label: "Planned" },
              { value: "seedling", label: "Seedling" },
              { value: "active", label: "Active" },
            ]}
            value={status}
            onChange={(v) => setStatus(v ?? "planned")}
          />
          <Button
            loading={createMutation.isPending}
            disabled={!name.trim()}
            onClick={() => createMutation.mutate()}
          >
            Add Plant
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
