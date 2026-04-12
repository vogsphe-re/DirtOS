import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlant, IconSeeding } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands, type SeedlingObservation } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Plant, Species } from "./types";
import { TransplantAssignmentModal } from "./TransplantAssignmentModal";

// ---------------------------------------------------------------------------
// Types (mirrors DB)
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Readiness heuristic
// ---------------------------------------------------------------------------

function isReadyToTransplant(
  obs: SeedlingObservation | undefined,
): boolean {
  if (!obs) return false;
  // Simple heuristic: at least 5 cm tall and at least 2 leaf nodes
  const heightOk = obs.height_cm != null && obs.height_cm >= 5;
  const leavesOk = obs.leaf_node_count != null && obs.leaf_node_count >= 2;
  return heightOk && leavesOk;
}

// ---------------------------------------------------------------------------
// SeedlingCard — per-plant card inside the tray grid
// ---------------------------------------------------------------------------

interface SeedlingCardProps {
  plant: Plant;
  species: Species | undefined;
  observations: SeedlingObservation[];
  onLogObs: (plant: Plant) => void;
  onTransplant: (plant: Plant) => void;
}

function SeedlingCard({ plant, species, observations, onLogObs, onTransplant }: SeedlingCardProps) {
  const navigate = useNavigate();
  const latest = observations[observations.length - 1];
  const ready = isReadyToTransplant(latest);

  return (
    <Card
      shadow="xs"
      padding="xs"
      radius="sm"
      withBorder
      style={{
        borderColor: ready ? "var(--mantine-color-green-4)" : undefined,
        minHeight: 110,
      }}
    >
      <Stack gap={4}>
        <Group gap={4} justify="space-between">
          <Text
            size="xs"
            fw={600}
            lineClamp={1}
            style={{ maxWidth: 110, cursor: "pointer", textDecoration: "underline" }}
            onClick={() => navigate({ to: "/plants/individuals/$plantId", params: { plantId: String(plant.id) } })}
          >
            {plant.name}
          </Text>
          {ready && (
            <Tooltip label="Ready to transplant">
              <Badge color="blue" size="xs" variant="dot">
                Ready
              </Badge>
            </Tooltip>
          )}
        </Group>

        {species && (
          <Text
            size="xs"
            c="dimmed"
            lineClamp={1}
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: "/plants/$speciesId", params: { speciesId: String(species.id) } });
            }}
          >
            {species.common_name}
          </Text>
        )}

        {latest ? (
          <Stack gap={2} mt={4}>
            {latest.height_cm != null && (
              <Text size="xs">📏 {latest.height_cm} cm</Text>
            )}
            {latest.leaf_node_count != null && (
              <Text size="xs">🌿 {latest.leaf_node_count} nodes</Text>
            )}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" mt={4}>
            No measurements
          </Text>
        )}

        <Group gap={4} mt="auto">
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => onLogObs(plant)}
          >
            Log
          </Button>
          <Button
            size="compact-xs"
            variant={ready ? "filled" : "outline"}
            color="green"
            onClick={() => onTransplant(plant)}
            disabled={!ready}
          >
            Transplant
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LogObservationModal
// ---------------------------------------------------------------------------

export interface LogObservationModalProps {
  plant: Plant;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function LogObservationModal({ plant, opened, onClose, onSaved }: LogObservationModalProps) {
  const [heightCm, setHeightCm] = useState<number | string>("");
  const [stemMm, setStemMm] = useState<number | string>("");
  const [leafCount, setLeafCount] = useState<number | string>("");
  const [leafSpacing, setLeafSpacing] = useState<number | string>("");
  const [notes, setNotes] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.createSeedlingObservation({
        plant_id: plant.id,
        observed_at: null,
        height_cm: heightCm !== "" ? Number(heightCm) : null,
        stem_thickness_mm: stemMm !== "" ? Number(stemMm) : null,
        leaf_node_count: leafCount !== "" ? Number(leafCount) : null,
        leaf_node_spacing_mm: leafSpacing !== "" ? Number(leafSpacing) : null,
        notes: notes.trim() || null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      notifications.show({ message: "Observation logged.", color: "green" });
      setHeightCm(""); setStemMm(""); setLeafCount(""); setLeafSpacing(""); setNotes("");
      onSaved();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Log observation: ${plant.name}`}
      size="sm"
    >
      <Stack gap="sm">
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="Height (cm)"
            value={heightCm}
            onChange={setHeightCm}
            min={0}
            decimalScale={1}
          />
          <NumberInput
            label="Stem thickness (mm)"
            value={stemMm}
            onChange={setStemMm}
            min={0}
            decimalScale={1}
          />
          <NumberInput
            label="Leaf node count"
            value={leafCount}
            onChange={setLeafCount}
            min={0}
            allowDecimal={false}
          />
          <NumberInput
            label="Leaf spacing (mm)"
            value={leafSpacing}
            onChange={setLeafSpacing}
            min={0}
            decimalScale={1}
          />
        </SimpleGrid>
        <TextInput
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Save observation
        </Button>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SeedlingPlanner (main component)
// ---------------------------------------------------------------------------

export function SeedlingPlanner() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();

  const [logTarget, setLogTarget] = useState<Plant | null>(null);
  const [transplantTarget, setTransplantTarget] = useState<Plant | null>(null);

  // All seedling-status plants in the current environment
  const { data: seedlings = [], isLoading } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
    select: (plants) =>
      plants.filter(
        (p) => (p.status as string).toLowerCase() === "seedling" && p.environment_id === activeEnvId,
      ),
    enabled: activeEnvId != null,
  });

  // All species (for names)
  const { data: speciesList = [] } = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const res = await commands.listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
  });

  const speciesById = new Map(speciesList.map((s) => [s.id, s]));

  // All observations for all seedlings
  const { data: allObs = [] } = useQuery({
    queryKey: ["seedling-obs", seedlings.map((s) => s.id).join(",")],
    queryFn: async () => {
      if (seedlings.length === 0) return [];
      const results = await Promise.all(
        seedlings.map(async (p) => {
          const res = await commands.listSeedlingObservations(p.id);
          if (res.status === "error") return [];
          return res.data as SeedlingObservation[];
        }),
      );
      return results.flat();
    },
    enabled: seedlings.length > 0,
  });

  const obsByPlant = new Map<number, SeedlingObservation[]>();
  for (const obs of allObs) {
    const arr = obsByPlant.get(obs.plant_id) ?? [];
    arr.push(obs);
    obsByPlant.set(obs.plant_id, arr);
  }

  if (!activeEnvId) {
    return (
      <Stack p="md">
        <Text c="dimmed">Select an environment in Settings to use the seedling planner.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <IconSeeding size={22} />
          <Title order={2}>Seedling Planner</Title>
        </Group>
        <Text size="sm" c="dimmed">
          {seedlings.length} seedling{seedlings.length !== 1 ? "s" : ""}
        </Text>
      </Group>

      <Text size="sm" c="dimmed">
        Double-click a seedling card to log measurements. When thresholds are met (≥5 cm, ≥2 leaf
        nodes), the "Transplant" button activates.
      </Text>

      {isLoading ? (
        <Text c="dimmed">Loading seedlings…</Text>
      ) : seedlings.length === 0 ? (
        <Box
          p="xl"
          style={{
            textAlign: "center",
            border: "1px dashed var(--mantine-color-default-border)",
            borderRadius: 8,
          }}
        >
          <IconPlant size={32} color="var(--mantine-color-green-5)" />
          <Text c="dimmed" mt="sm">
            No seedlings yet. Start plants indoors and set their status to "Seedling".
          </Text>
        </Box>
      ) : (
        <ScrollArea>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm">
            {seedlings.map((plant) => (
              <SeedlingCard
                key={plant.id}
                plant={plant}
                species={plant.species_id != null ? speciesById.get(plant.species_id) : undefined}
                observations={obsByPlant.get(plant.id) ?? []}
                onLogObs={(p) => setLogTarget(p)}
                onTransplant={(p) => setTransplantTarget(p)}
              />
            ))}
          </SimpleGrid>
        </ScrollArea>
      )}

      {/* Log observation modal */}
      {logTarget && (
        <LogObservationModal
          plant={logTarget}
          opened={logTarget != null}
          onClose={() => setLogTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["seedling-obs"] });
            setLogTarget(null);
          }}
        />
      )}

      <TransplantAssignmentModal
        opened={transplantTarget != null}
        environmentId={activeEnvId}
        plant={transplantTarget}
        onClose={() => setTransplantTarget(null)}
      />
    </Stack>
  );
}
