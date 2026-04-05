import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconGridDots,
  IconPlus,
  IconSeeding,
  IconTrash,
  IconEdit,
  IconArrowRight,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  commands,
  type SeedlingTray,
  type SeedlingTrayCell,
  type SeedlingObservation,
} from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Plant, Species } from "./types";
import { AssetTagInline } from "../../components/AssetTagBadge";

// ---------------------------------------------------------------------------
// Create / edit tray modal
// ---------------------------------------------------------------------------

interface TrayFormModalProps {
  opened: boolean;
  onClose: () => void;
  tray?: SeedlingTray | null;
}

function TrayFormModal({ opened, onClose, tray }: TrayFormModalProps) {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();

  const [name, setName] = useState(tray?.name ?? "");
  const [rows, setRows] = useState<number | string>(tray?.rows ?? 4);
  const [cols, setCols] = useState<number | string>(tray?.cols ?? 6);
  const [cellSize, setCellSize] = useState<number | string>(tray?.cell_size_cm ?? "");
  const [notes, setNotes] = useState(tray?.notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (tray) {
        const res = await commands.updateSeedlingTray(tray.id, {
          name: name || null,
          rows: rows !== "" ? Number(rows) : null,
          cols: cols !== "" ? Number(cols) : null,
          cell_size_cm: cellSize !== "" ? Number(cellSize) : null,
          notes: notes.trim() || null,
        });
        if (res.status === "error") throw new Error(res.error);
        return res.data;
      } else {
        const res = await commands.createSeedlingTray({
          environment_id: activeEnvId!,
          name,
          rows: Number(rows) || 4,
          cols: Number(cols) || 6,
          cell_size_cm: cellSize !== "" ? Number(cellSize) : null,
          notes: notes.trim() || null,
        });
        if (res.status === "error") throw new Error(res.error);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seedling-trays"] });
      notifications.show({ message: tray ? "Tray updated." : "Tray created." });
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={tray ? "Edit tray" : "New seedling tray"} size="sm">
      <Stack gap="sm">
        <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput label="Rows" value={rows} onChange={setRows} min={1} max={20} />
          <NumberInput label="Columns" value={cols} onChange={setCols} min={1} max={20} />
        </SimpleGrid>
        <NumberInput label="Cell size (cm)" value={cellSize} onChange={setCellSize} min={1} decimalScale={1} />
        <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!name.trim()}>
            {tray ? "Update" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Assign plant to cell modal
// ---------------------------------------------------------------------------

interface AssignCellModalProps {
  opened: boolean;
  onClose: () => void;
  tray: SeedlingTray;
  row: number;
  col: number;
  plants: Plant[];
  species: Map<number, Species>;
}

function AssignCellModal({ opened, onClose, tray, row, col, plants, species }: AssignCellModalProps) {
  const queryClient = useQueryClient();
  const [plantId, setPlantId] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.assignSeedlingTrayCell({
        tray_id: tray.id,
        row,
        col,
        plant_id: plantId ? Number(plantId) : null,
        notes: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tray-cells", tray.id] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Cell updated." });
      setPlantId(null);
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  // Available seedling-status plants not already assigned elsewhere could be shown.
  // For simplicity, show all seedling/planned plants.
  const plantOptions = plants
    .filter((p) => {
      const s = (p.status as string).toLowerCase();
      return s === "seedling" || s === "planned";
    })
    .map((p) => {
      const sp = p.species_id != null ? species.get(p.species_id) : undefined;
      return {
        value: String(p.id),
        label: `${p.name}${sp ? ` (${sp.common_name})` : ""}`,
      };
    });

  return (
    <Modal opened={opened} onClose={onClose} title={`Assign plant — Row ${row + 1}, Col ${col + 1}`} size="sm">
      <Stack gap="sm">
        <Select
          label="Select plant"
          placeholder="Choose a seedling or planned plant"
          data={plantOptions}
          value={plantId}
          onChange={setPlantId}
          searchable
          clearable
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={assignMutation.isPending} onClick={() => assignMutation.mutate()}>
            Assign
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Grid cell component
// ---------------------------------------------------------------------------

interface GridCellProps {
  cell: SeedlingTrayCell | undefined;
  plant: Plant | undefined;
  species: Species | undefined;
  latestObs: SeedlingObservation | undefined;
  onAssign: () => void;
  onClear: () => void;
  onTransplant: () => void;
}

function GridCell({ cell, plant, species, latestObs, onAssign, onClear, onTransplant }: GridCellProps) {
  const navigate = useNavigate();
  const ready = latestObs
    ? (latestObs.height_cm ?? 0) >= 5 && (latestObs.leaf_node_count ?? 0) >= 2
    : false;

  if (!cell || !cell.plant_id || !plant) {
    // Empty cell
    return (
      <Box
        onClick={onAssign}
        style={{
          border: "1px dashed var(--mantine-color-default-border)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 80,
          cursor: "pointer",
          opacity: 0.5,
          transition: "opacity 150ms",
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
      >
        <IconPlus size={16} color="var(--mantine-color-dimmed)" />
      </Box>
    );
  }

  return (
    <Card
      shadow="xs"
      padding={6}
      radius="sm"
      withBorder
      style={{
        borderColor: ready ? "var(--mantine-color-green-4)" : undefined,
        minHeight: 80,
      }}
    >
      <Stack gap={2}>
        <Group gap={4} justify="space-between" wrap="nowrap">
          <Text size="xs" fw={600} lineClamp={1} style={{ maxWidth: 80 }}>
            {plant.name}
          </Text>
          <Group gap={2} wrap="nowrap">
            {ready && (
              <Tooltip label="Ready to transplant">
                <Badge color="blue" size="xs" variant="dot">OK</Badge>
              </Tooltip>
            )}
            <Tooltip label="Remove from cell">
              <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); onClear(); }}>
                <IconTrash size={10} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {species && (
          <Text
            size="xs"
            c="dimmed"
            lineClamp={1}
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={() => navigate({ to: "/plants/$speciesId", params: { speciesId: String(species.id) } })}
          >
            {species.common_name}
          </Text>
        )}

        {latestObs ? (
          <Group gap={4}>
            {latestObs.height_cm != null && <Text size="xs">📏 {latestObs.height_cm}cm</Text>}
            {latestObs.leaf_node_count != null && <Text size="xs">🌿 {latestObs.leaf_node_count}</Text>}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">No data</Text>
        )}

        {ready && (
          <Tooltip label="Transplant to garden">
            <Button size="compact-xs" variant="light" color="blue" onClick={onTransplant} fullWidth>
              <IconArrowRight size={12} />
            </Button>
          </Tooltip>
        )}
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tray grid view
// ---------------------------------------------------------------------------

interface TrayGridViewProps {
  tray: SeedlingTray;
  onBack: () => void;
}

function TrayGridView({ tray, onBack }: TrayGridViewProps) {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ row: number; col: number } | null>(null);
  const [transplantTarget, setTransplantTarget] = useState<Plant | null>(null);

  // Load tray cells
  const { data: cells = [] } = useQuery({
    queryKey: ["tray-cells", tray.id],
    queryFn: async () => {
      const res = await commands.listSeedlingTrayCells(tray.id);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  // All plants for assignment + display
  const { data: allPlants = [] } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
  });

  const envPlants = allPlants.filter((p) => p.environment_id === activeEnvId);
  const plantsById = new Map(envPlants.map((p) => [p.id, p]));

  // All species
  const { data: speciesList = [] } = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const res = await commands.listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
  });
  const speciesById = new Map(speciesList.map((s) => [s.id, s]));

  // Observations for plants in this tray
  const assignedPlantIds = cells.filter((c) => c.plant_id).map((c) => c.plant_id!);
  const { data: allObs = [] } = useQuery({
    queryKey: ["seedling-obs-tray", tray.id, assignedPlantIds.join(",")],
    queryFn: async () => {
      if (assignedPlantIds.length === 0) return [];
      const results = await Promise.all(
        assignedPlantIds.map(async (pid) => {
          const res = await commands.listSeedlingObservations(pid);
          if (res.status === "error") return [];
          return res.data as SeedlingObservation[];
        }),
      );
      return results.flat();
    },
    enabled: assignedPlantIds.length > 0,
  });

  const latestObsByPlant = new Map<number, SeedlingObservation>();
  for (const obs of allObs) {
    const current = latestObsByPlant.get(obs.plant_id);
    if (!current || obs.observed_at > current.observed_at) {
      latestObsByPlant.set(obs.plant_id, obs);
    }
  }

  // Build cell lookup
  const cellMap = new Map<string, SeedlingTrayCell>();
  for (const c of cells) {
    cellMap.set(`${c.row},${c.col}`, c);
  }

  // Clear a cell
  const clearMutation = useMutation({
    mutationFn: async ({ row, col }: { row: number; col: number }) => {
      const res = await commands.clearSeedlingTrayCell(tray.id, row, col);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tray-cells", tray.id] });
    },
  });

  // Transplant
  const transplantMutation = useMutation({
    mutationFn: async (plantId: number) => {
      const res = await commands.transitionPlantStatus(plantId, "active");
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tray-cells", tray.id] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Plant transplanted to Active." });
      setTransplantTarget(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  // Build the grid
  const gridRows: React.ReactNode[] = [];
  for (let r = 0; r < tray.rows; r++) {
    const gridCells: React.ReactNode[] = [];
    for (let c = 0; c < tray.cols; c++) {
      const cell = cellMap.get(`${r},${c}`);
      const plant = cell?.plant_id ? plantsById.get(cell.plant_id) : undefined;
      const sp = plant?.species_id != null ? speciesById.get(plant.species_id) : undefined;
      const obs = cell?.plant_id ? latestObsByPlant.get(cell.plant_id) : undefined;

      gridCells.push(
        <GridCell
          key={`${r}-${c}`}
          cell={cell}
          plant={plant}
          species={sp}
          latestObs={obs}
          onAssign={() => setAssignTarget({ row: r, col: c })}
          onClear={() => clearMutation.mutate({ row: r, col: c })}
          onTransplant={() => plant && setTransplantTarget(plant)}
        />,
      );
    }
    gridRows.push(
      <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${tray.cols}, 1fr)`, gap: 6 }}>
        {gridCells}
      </div>,
    );
  }

  const filledCount = cells.filter((c) => c.plant_id).length;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Button variant="subtle" size="compact-sm" onClick={onBack}>← Back</Button>
          <IconGridDots size={20} />
          <Title order={3}>{tray.name}</Title>
          <Badge variant="light" size="sm">
            {tray.rows} × {tray.cols}
          </Badge>
          <Text size="sm" c="dimmed">{filledCount} / {tray.rows * tray.cols} cells</Text>
        </Group>
        <Button variant="subtle" size="compact-sm" leftSection={<IconEdit size={14} />} onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </Group>

      <ScrollArea>
        <Stack gap={6}>{gridRows}</Stack>
      </ScrollArea>

      {/* Edit tray modal */}
      {editOpen && (
        <TrayFormModal opened={editOpen} onClose={() => setEditOpen(false)} tray={tray} />
      )}

      {/* Assign cell modal */}
      {assignTarget && (
        <AssignCellModal
          opened={assignTarget != null}
          onClose={() => setAssignTarget(null)}
          tray={tray}
          row={assignTarget.row}
          col={assignTarget.col}
          plants={envPlants}
          species={speciesById}
        />
      )}

      {/* Transplant confirmation */}
      <Modal opened={transplantTarget != null} onClose={() => setTransplantTarget(null)} title="Confirm transplant" size="xs">
        <Stack gap="sm">
          <Text size="sm">
            Move <strong>{transplantTarget?.name}</strong> to "Active" status and remove from tray?
          </Text>
          <Text size="xs" c="dimmed">
            This sets today as the transplant date and transitions the plant to active growing.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setTransplantTarget(null)}>Cancel</Button>
            <Button
              color="blue"
              size="xs"
              loading={transplantMutation.isPending}
              onClick={() => transplantTarget && transplantMutation.mutate(transplantTarget.id)}
            >
              Transplant
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main exported component — tray list + detail
// ---------------------------------------------------------------------------

export function SeedlingTrayManager() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTray, setActiveTray] = useState<SeedlingTray | null>(null);

  const { data: trays = [], isLoading } = useQuery({
    queryKey: ["seedling-trays", activeEnvId],
    queryFn: async () => {
      const res = await commands.listSeedlingTrays(activeEnvId!);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: activeEnvId != null,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteSeedlingTray(id);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seedling-trays"] });
      notifications.show({ message: "Tray deleted." });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (!activeEnvId) {
    return (
      <Stack p="md">
        <Text c="dimmed">Select an environment in Settings to manage seedling trays.</Text>
      </Stack>
    );
  }

  // Detail view
  if (activeTray) {
    return (
      <Stack p="md">
        <TrayGridView tray={activeTray} onBack={() => setActiveTray(null)} />
      </Stack>
    );
  }

  // List view
  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <IconGridDots size={22} />
          <Title order={2}>Seedling Trays</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Tray
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Set up seedling trays with a grid layout. Assign plants to cells and track growth before transplanting to the garden.
      </Text>

      {isLoading ? (
        <Text c="dimmed">Loading trays…</Text>
      ) : trays.length === 0 ? (
        <Box
          p="xl"
          style={{
            textAlign: "center",
            border: "1px dashed var(--mantine-color-default-border)",
            borderRadius: 8,
          }}
        >
          <IconSeeding size={32} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" mt="sm">
            No seedling trays yet. Create one to start organizing your seedlings.
          </Text>
        </Box>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {trays.map((tray) => (
            <Card
              key={tray.id}
              shadow="xs"
              padding="md"
              radius="md"
              withBorder
              style={{ cursor: "pointer" }}
              onClick={() => setActiveTray(tray)}
            >
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>{tray.name}</Text>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(tray.id);
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
                <Group gap="sm">
                  <Badge variant="light" size="sm">
                    {tray.rows} × {tray.cols}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {tray.rows * tray.cols} cells
                  </Text>
                  {tray.cell_size_cm && (
                    <Text size="xs" c="dimmed">{tray.cell_size_cm} cm</Text>
                  )}
                </Group>
                {tray.notes && (
                  <Text size="xs" c="dimmed" lineClamp={2}>{tray.notes}</Text>
                )}
                {tray.asset_id && (
                  <Text size="xs" c="dimmed">Tag: <AssetTagInline tag={tray.asset_id} /></Text>
                )}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {createOpen && (
        <TrayFormModal opened={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </Stack>
  );
}
