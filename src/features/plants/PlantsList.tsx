import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Plant, PlantStatus, Species } from "./types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "./types";

export function PlantsList() {
  const navigate = useNavigate();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const [statusFilter, setStatusFilter] = useState<PlantStatus | "">("");
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: plants = [], isLoading, isError } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await (commands as any).listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await (commands as any).deletePlant(id);
      if (res.status === "error") throw new Error(res.error);
      return res.data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Plant deleted.", color: "orange" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const filtered = statusFilter
    ? plants.filter((p) => p.status === statusFilter)
    : plants;

  const rows = filtered.map((p) => (
    <Table.Tr
      key={p.id}
      style={{ cursor: "pointer" }}
      onClick={() =>
        navigate({ to: "/plants/individuals/$plantId", params: { plantId: String(p.id) } })
      }
    >
      <Table.Td>
        <Text fw={500}>{p.name}</Text>
        {p.label && <Text size="xs" c="dimmed">{p.label}</Text>}
      </Table.Td>
      <Table.Td>
        <Badge color={PLANT_STATUS_COLORS[p.status]} variant="light" size="sm">
          {PLANT_STATUS_LABELS[p.status]}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{p.planted_date ?? "—"}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          Env #{p.environment_id}
        </Text>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Group gap={4}>
          <Tooltip label="Edit">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() =>
                navigate({ to: "/plants/individuals/$plantId", params: { plantId: String(p.id) } })
              }
            >
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              loading={deleteMut.isPending}
              onClick={() => {
                if (confirm(`Delete plant "${p.name}"? This will also remove associated data.`))
                  deleteMut.mutate(p.id);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Individual Plants</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setAddOpen(true)}
          disabled={!activeEnvId}
        >
          Add Plant
        </Button>
      </Group>

      <Group gap="sm">
        <Select
          placeholder="All statuses"
          data={[
            { value: "", label: "All statuses" },
            ...Object.entries(PLANT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter((v as PlantStatus | "") ?? "")}
          w={180}
          clearable
        />
      </Group>

      {isError && <Text c="red">Failed to load plants.</Text>}

      <Table highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Planted</Table.Th>
            <Table.Th>Environment</Table.Th>
            <Table.Th w={80}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed" py="lg">Loading…</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed" py="lg">No plants found.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows
          )}
        </Table.Tbody>
      </Table>

      {!activeEnvId && (
        <Text size="sm" c="dimmed" ta="center">
          Select an environment in Settings to add plants.
        </Text>
      )}

      {activeEnvId && (
        <AddPlantModal
          opened={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ["plants-all"] });
          }}
        />
      )}
    </Stack>
  );
}

// ————————————————————————————————————————————
// Shared AddPlantModal (exported for reuse in SpeciesDetail)
// ————————————————————————————————————————————
interface AddPlantModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (plant: Plant) => void;
  defaultSpeciesId?: number;
}

export function AddPlantModal({
  opened,
  onClose,
  onCreated,
  defaultSpeciesId,
}: AddPlantModalProps) {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const { data: speciesList = [] } = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const res = await (commands as any).listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
  });

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [speciesId, setSpeciesId] = useState<string | null>(
    defaultSpeciesId ? String(defaultSpeciesId) : null,
  );
  const [status, setStatus] = useState<PlantStatus>("planned");
  const [plantedDate, setPlantedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) { setNameError("Plant name is required"); throw new Error("Validation"); }
      if (!activeEnvId) throw new Error("No active environment selected");
      setNameError("");
      const res = await (commands as any).createPlant({
        species_id: speciesId ? parseInt(speciesId) : null,
        location_id: null,
        environment_id: activeEnvId,
        status,
        name: name.trim(),
        label: label.trim() || null,
        planted_date: plantedDate || null,
        notes: notes.trim() || null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: (plant) => {
      notifications.show({ title: "Created", message: `${plant.name} added.`, color: "green" });
      setName(""); setLabel(""); setSpeciesId(defaultSpeciesId ? String(defaultSpeciesId) : null);
      setStatus("planned"); setPlantedDate(""); setNotes("");
      // Trigger background Trefle enrichment for the plant's species if it
      // doesn't have data yet. Fire-and-forget; errors are silently ignored.
      if (plant.species_id != null) {
        commands.autoEnrichTrefle([plant.species_id]).catch(() => {/* no-op */});
      }
      onCreated(plant);
    },
    onError: (err: Error) => {
      if (err.message !== "Validation")
        notifications.show({ title: "Error", message: err.message, color: "red" });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Plant"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="sm">
        <TextInput
          label="Plant name"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={nameError}
        />
        <TextInput
          label="Label / tag"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        <Select
          label="Species"
          searchable
          clearable
          data={speciesList.map((sp) => ({
            value: String(sp.id),
            label: sp.common_name + (sp.scientific_name ? ` (${sp.scientific_name})` : ""),
          }))}
          value={speciesId}
          onChange={setSpeciesId}
        />
        <SimpleGrid cols={2} spacing="sm">
          <Select
            label="Status"
            data={Object.entries(PLANT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={status}
            onChange={(v) => setStatus((v as PlantStatus) ?? "planned")}
          />
          <TextInput
            label="Planted date"
            type="date"
            value={plantedDate}
            onChange={(e) => setPlantedDate(e.currentTarget.value)}
          />
        </SimpleGrid>
        <Textarea
          label="Notes"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
            Save plant
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
