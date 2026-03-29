import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Plant, Species } from "../plants/types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "../plants/types";

interface PlantAssignmentModalProps {
  opened: boolean;
  spaceId: string;
  /** canvas-level label for the space, shown in title */
  spaceLabel?: string;
  /** If already assigned, the current plant id */
  currentPlantId?: number | null;
  onClose: () => void;
  onAssigned: (plantId: number | null) => void;
}

export function PlantAssignmentModal({
  opened,
  spaceId,
  spaceLabel,
  currentPlantId,
  onClose,
  onAssigned,
}: PlantAssignmentModalProps) {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();

  // Existing assignable plants
  const { data: allPlants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
    enabled: opened,
  });

  const { data: speciesList = [] } = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const res = await commands.listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
    enabled: opened,
  });

  // "Create new" form state
  const [newName, setNewName] = useState("");
  const [newSpeciesId, setNewSpeciesId] = useState<string | null>(null);

  // "Pick existing" selection
  const assignablePlants = allPlants.filter(
    (plant) =>
      plant.environment_id === activeEnvId &&
      (plant.status === "planned" || plant.status === "seedling" || plant.status === "active") &&
      (plant.canvas_object_id == null || plant.id === currentPlantId),
  );

  const [pickedPlantId, setPickedPlantId] = useState<string | null>(
    currentPlantId ? String(currentPlantId) : null,
  );

  const createAndAssign = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Plant name is required");
      if (!activeEnvId) throw new Error("No active environment");
      if (currentPlantId) {
        const clearResult = await commands.unassignPlantFromCanvasObject(currentPlantId);
        if (clearResult.status === "error") throw new Error(clearResult.error);
      }
      const res = await commands.createPlant({
        species_id: newSpeciesId ? parseInt(newSpeciesId) : null,
        location_id: null,
        environment_id: activeEnvId,
        status: "planned",
        name: newName.trim(),
        label: null,
        planted_date: null,
        notes: null,
        canvas_object_id: spaceId,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: (plant) => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      queryClient.invalidateQueries({ queryKey: ["canvas-plants"] });
      notifications.show({ message: `${plant.name} created and assigned.`, color: "green" });
      onAssigned(plant.id);
      setNewName("");
      setNewSpeciesId(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const doAssignExisting = useMutation({
    mutationFn: async () => {
      if (!pickedPlantId) throw new Error("No plant selected");
      const plantId = parseInt(pickedPlantId);
      if (currentPlantId && currentPlantId !== plantId) {
        const clearResult = await commands.unassignPlantFromCanvasObject(currentPlantId);
        if (clearResult.status === "error") throw new Error(clearResult.error);
      }
      const res = await commands.assignPlantToCanvasObject(plantId, spaceId, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: (plant) => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      queryClient.invalidateQueries({ queryKey: ["canvas-plants"] });
      onAssigned(plant.id);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const doClearAssignment = useMutation({
    mutationFn: async () => {
      if (!currentPlantId) return;
      const res = await commands.unassignPlantFromCanvasObject(currentPlantId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      queryClient.invalidateQueries({ queryKey: ["canvas-plants"] });
      onAssigned(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const spaceTitle = spaceLabel ? `"${spaceLabel}"` : "this space";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Assign plant to ${spaceTitle}`}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Tabs defaultValue="existing">
        <Tabs.List>
          <Tabs.Tab value="existing">Pick existing</Tabs.Tab>
          <Tabs.Tab value="new">Create new</Tabs.Tab>
        </Tabs.List>

        {/* ── Pick existing ── */}
        <Tabs.Panel value="existing" pt="md">
          <Stack gap="sm">
            {plantsLoading ? (
              <Loader size="sm" />
            ) : assignablePlants.length === 0 ? (
              <Text size="sm" c="dimmed">
                No assignable plants yet. Create a new one instead.
              </Text>
            ) : (
              <Select
                label="Plant"
                searchable
                data={assignablePlants.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} (${PLANT_STATUS_LABELS[p.status]})`,
                }))}
                value={pickedPlantId}
                onChange={setPickedPlantId}
                placeholder="Search plants…"
              />
            )}
            {pickedPlantId && (
              <PlantPreview
                plant={assignablePlants.find((p) => String(p.id) === pickedPlantId)}
                speciesList={speciesList}
              />
            )}
            <Group justify="space-between" mt="xs">
              {currentPlantId && (
                <Button variant="subtle" color="red" size="xs" onClick={() => doClearAssignment.mutate()} loading={doClearAssignment.isPending}>
                  Remove assignment
                </Button>
              )}
              <Button
                ml="auto"
                disabled={!pickedPlantId}
                loading={doAssignExisting.isPending}
                onClick={() => doAssignExisting.mutate()}
              >
                Assign
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        {/* ── Create new ── */}
        <Tabs.Panel value="new" pt="md">
          <Stack gap="sm">
            <TextInput
              label="Plant name"
              required
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              placeholder="e.g. Tomato #3"
            />
            <Select
              label="Species (optional)"
              searchable
              clearable
              data={speciesList.map((sp) => ({
                value: String(sp.id),
                label:
                  sp.common_name +
                  (sp.scientific_name ? ` (${sp.scientific_name})` : ""),
              }))}
              value={newSpeciesId}
              onChange={setNewSpeciesId}
            />
            <Button
              loading={createAndAssign.isPending}
              onClick={() => createAndAssign.mutate()}
              disabled={!newName.trim()}
            >
              Create & assign
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function PlantPreview({
  plant,
  speciesList,
}: {
  plant: Plant | undefined;
  speciesList: Species[];
}) {
  if (!plant) return null;
  const species = speciesList.find((s) => s.id === plant.species_id);
  return (
    <Stack gap={4} p="xs" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 6 }}>
      <Group gap="xs">
        <Text size="sm" fw={500}>
          {plant.name}
        </Text>
        <Badge color={PLANT_STATUS_COLORS[plant.status]} variant="light" size="xs">
          {PLANT_STATUS_LABELS[plant.status]}
        </Badge>
      </Group>
      {species && (
        <Text size="xs" c="dimmed">
          {species.common_name}
          {species.scientific_name ? ` · ${species.scientific_name}` : ""}
        </Text>
      )}
      {plant.planted_date && (
        <Text size="xs" c="dimmed">
          Planted: {plant.planted_date}
        </Text>
      )}
    </Stack>
  );
}
