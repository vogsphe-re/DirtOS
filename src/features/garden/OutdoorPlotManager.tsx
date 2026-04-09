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
import { IconArrowLeft, IconExternalLink, IconLayoutGridAdd, IconMap2, IconPlant, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { commands, type Location, type Plant } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Species } from "../plants/types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "../plants/types";
import { AreaGeneratorModal } from "./AreaGeneratorModal";
import { useCanvasStore } from "./canvasStore";
import { buildRectGridObjects, type RectGridLayout } from "./layoutGeneration";
import { PlantAssignmentModal } from "./PlantAssignmentModal";
import { useCanvasPersistence } from "./hooks/useCanvasPersistence";
import type { CanvasObject } from "./types";

interface PlotGridCellEntry {
  spaces: CanvasObject[];
}

interface PlotGridData {
  rowCount: number;
  columnCount: number;
  cells: Map<string, PlotGridCellEntry>;
}

interface PlotOccupancySummary {
  totalSpaces: number;
  occupiedSpaces: number;
  emptySpaces: number;
  plannedCount: number;
  activeCount: number;
  seedlingCount: number;
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clusterValues(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const clusters: number[] = [];

  for (const value of sorted) {
    const last = clusters.at(-1);
    if (last == null || Math.abs(value - last) > tolerance) {
      clusters.push(value);
      continue;
    }

    clusters[clusters.length - 1] = (last + value) / 2;
  }

  return clusters;
}

function findNearestIndex(anchors: number[], value: number): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  anchors.forEach((anchor, index) => {
    const distance = Math.abs(anchor - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function buildPlotGrid(spaces: CanvasObject[]): PlotGridData {
  if (spaces.length === 0) {
    return { rowCount: 0, columnCount: 0, cells: new Map() };
  }

  const centers = spaces.map((space) => ({
    space,
    centerX: space.x + (space.width ?? 40) / 2,
    centerY: space.y + (space.height ?? 40) / 2,
  }));

  const xAnchors = clusterValues(
    centers.map((entry) => entry.centerX),
    Math.max(12, average(spaces.map((space) => space.width ?? 40), 40) * 0.45),
  );
  const yAnchors = clusterValues(
    centers.map((entry) => entry.centerY),
    Math.max(12, average(spaces.map((space) => space.height ?? 40), 40) * 0.45),
  );

  const cells = new Map<string, PlotGridCellEntry>();

  for (const entry of centers) {
    const row = findNearestIndex(yAnchors, entry.centerY);
    const col = findNearestIndex(xAnchors, entry.centerX);
    const key = `${row}:${col}`;
    const existing = cells.get(key);

    if (existing) {
      existing.spaces.push(entry.space);
    } else {
      cells.set(key, { spaces: [entry.space] });
    }
  }

  return {
    rowCount: yAnchors.length,
    columnCount: xAnchors.length,
    cells,
  };
}

function formatSpaceSize(space: CanvasObject, pixelsPerUnit: number, unit: string): string {
  const width = ((space.width ?? 0) / pixelsPerUnit).toFixed(1);
  const height = ((space.height ?? 0) / pixelsPerUnit).toFixed(1);
  return `${width} x ${height} ${unit}`;
}

function summarizePlot(spaces: CanvasObject[], plantsBySpace: Map<string, Plant[]>): PlotOccupancySummary {
  const summary: PlotOccupancySummary = {
    totalSpaces: spaces.length,
    occupiedSpaces: 0,
    emptySpaces: 0,
    plannedCount: 0,
    activeCount: 0,
    seedlingCount: 0,
  };

  for (const space of spaces) {
    const plant = plantsBySpace.get(space.id)?.[0];
    if (!plant) {
      summary.emptySpaces += 1;
      continue;
    }

    summary.occupiedSpaces += 1;
    if (plant.status === "planned") summary.plannedCount += 1;
    if (plant.status === "active") summary.activeCount += 1;
    if (plant.status === "seedling") summary.seedlingCount += 1;
  }

  return summary;
}

function PlotSpaceCard({
  space,
  plant,
  species,
  duplicateCount,
  pixelsPerUnit,
  unit,
  onAssign,
  onClear,
  onOpenPlant,
}: {
  space?: CanvasObject;
  plant?: Plant;
  species?: Species;
  duplicateCount: number;
  pixelsPerUnit: number;
  unit: string;
  onAssign: () => void;
  onClear: () => void;
  onOpenPlant?: () => void;
}) {
  if (!space) {
    return (
      <Box
        style={{
          minHeight: 148,
          borderRadius: 8,
          border: "1px dashed var(--mantine-color-default-border)",
          opacity: 0.22,
        }}
      />
    );
  }

  const title = space.label?.trim() || "Unnamed space";

  if (!plant) {
    return (
      <Card withBorder padding="sm" radius="md" style={{ minHeight: 148 }}>
        <Stack gap="xs" h="100%">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} style={{ flex: 1 }}>
              <Text fw={600} size="sm" lineClamp={1}>{title}</Text>
              <Text size="xs" c="dimmed">{formatSpaceSize(space, pixelsPerUnit, unit)}</Text>
            </Stack>
            {duplicateCount > 0 && (
              <Tooltip label="Multiple canvas spaces resolved to this grid slot">
                <Badge variant="light" color="yellow" size="xs">+{duplicateCount}</Badge>
              </Tooltip>
            )}
          </Group>
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            No plant assigned to this outdoor space.
          </Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={onAssign}>
            Assign plant
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder padding="sm" radius="md" style={{ minHeight: 148 }}>
      <Stack gap="xs" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1 }}>
            <Text fw={600} size="sm" lineClamp={1}>{plant.name}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>{title}</Text>
          </Stack>
          <Group gap={4} wrap="nowrap">
            <Badge variant="light" color={PLANT_STATUS_COLORS[plant.status]} size="xs">
              {PLANT_STATUS_LABELS[plant.status]}
            </Badge>
            {onOpenPlant && (
              <Tooltip label="Open plant details">
                <ActionIcon size="sm" variant="subtle" onClick={onOpenPlant}>
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Remove assignment">
              <ActionIcon size="sm" variant="subtle" color="red" onClick={onClear}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        {species && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {species.common_name}
            {species.scientific_name ? ` · ${species.scientific_name}` : ""}
          </Text>
        )}
        <Group gap="xs">
          <Badge variant="outline" size="xs">{formatSpaceSize(space, pixelsPerUnit, unit)}</Badge>
          {duplicateCount > 0 && <Badge variant="outline" color="yellow" size="xs">+{duplicateCount} overlap</Badge>}
        </Group>
        <Button size="xs" variant="light" leftSection={<IconPlant size={14} />} onClick={onAssign}>
          Change assignment
        </Button>
      </Stack>
    </Card>
  );
}

export function OutdoorPlotManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeEnvironmentId = useAppStore((state) => state.activeEnvironmentId);
  const objects = useCanvasStore((state) => state.objects);
  const gridConfig = useCanvasStore((state) => state.gridConfig);
  const setObjects = useCanvasStore((state) => state.setObjects);
  const setDirty = useCanvasStore((state) => state.setDirty);
  const { loadCanvas } = useCanvasPersistence();

  const [activePlotId, setActivePlotId] = useState<string | null>(null);
  const [assigningSpaceId, setAssigningSpaceId] = useState<string | null>(null);
  const [subdivideOpen, setSubdivideOpen] = useState(false);
  const [createPlotGroupOpen, setCreatePlotGroupOpen] = useState(false);
  const [plotGroupName, setPlotGroupName] = useState("");
  const [plotGroupPrefix, setPlotGroupPrefix] = useState("");
  const [plotGroupRows, setPlotGroupRows] = useState<number | string>(2);
  const [plotGroupCols, setPlotGroupCols] = useState<number | string>(4);
  const [plotGroupSiteId, setPlotGroupSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (activeEnvironmentId != null) {
      void loadCanvas(activeEnvironmentId);
    }
  }, [activeEnvironmentId, loadCanvas]);

  const plots = useMemo(
    () => [...objects.filter((object) => object.type === "plot")].sort((left, right) => left.y - right.y || left.x - right.x),
    [objects],
  );

  useEffect(() => {
    if (plots.length === 0) return;
    const preferredId = localStorage.getItem('garden-active-plot-id');
    if (!preferredId) return;

    if (plots.some((plot) => plot.id === preferredId)) {
      setActivePlotId(preferredId);
    }

    localStorage.removeItem('garden-active-plot-id');
  }, [plots]);

  useEffect(() => {
    if (plots.length === 0) {
      setActivePlotId(null);
      return;
    }

    if (!activePlotId || !plots.some((plot) => plot.id === activePlotId)) {
      setActivePlotId(plots[0].id);
    }
  }, [activePlotId, plots]);

  const { data: allPlants = [] } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const result = await commands.listAllPlants(500, 0);
      if (result.status === "error") throw new Error(result.error);
      return result.data as Plant[];
    },
    enabled: activeEnvironmentId != null,
  });

  const { data: canvasPlants = [] } = useQuery({
    queryKey: ["canvas-plants", activeEnvironmentId],
    queryFn: async () => {
      if (activeEnvironmentId == null) return [] as Plant[];
      const result = await commands.getPlantsForCanvas(activeEnvironmentId);
      if (result.status === "error") throw new Error(result.error);
      return result.data as Plant[];
    },
    enabled: activeEnvironmentId != null,
  });

  const { data: speciesList = [] } = useQuery({
    queryKey: ["species", null, null, null, null, 500, 0],
    queryFn: async () => {
      const result = await commands.listSpecies(null, null, null, null, 500, 0);
      if (result.status === "error") throw new Error(result.error);
      return result.data as Species[];
    },
    enabled: activeEnvironmentId != null,
  });

  const { data: hierarchyLocations = [] } = useQuery({
    queryKey: ["locations", activeEnvironmentId],
    queryFn: async () => {
      if (activeEnvironmentId == null) return [] as Location[];
      const result = await commands.listLocations(activeEnvironmentId);
      if (result.status === "error") throw new Error(result.error);
      return result.data as Location[];
    },
    enabled: activeEnvironmentId != null,
  });

  const activePlot = plots.find((plot) => plot.id === activePlotId) ?? null;

  const clearAssignment = useMutation({
    mutationFn: async (plantId: number) => {
      const result = await commands.unassignPlantFromCanvasObject(plantId);
      if (result.status === "error") throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["canvas-plants", activeEnvironmentId] });
      void queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ color: "green", message: "Plot space cleared." });
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Error", message: error.message });
    },
  });

  const subdividePlot = useMutation({
    mutationFn: async ({
      layout,
      labelPrefix,
      replaceExistingSpaces,
    }: {
      layout: RectGridLayout;
      labelPrefix: string;
      replaceExistingSpaces: boolean;
    }) => {
      if (!activeEnvironmentId) throw new Error("No active environment");
      if (!activePlot) throw new Error("No plot selected");

      const existingSpaces = objects.filter((object) => object.type === "space" && object.parentId === activePlot.id);
      const assignedPlantIds = replaceExistingSpaces
        ? existingSpaces.flatMap((space) => (canvasPlantsBySpace.get(space.id) ?? []).map((plant) => plant.id))
        : [];

      for (const plantId of new Set(assignedPlantIds)) {
        const result = await commands.unassignPlantFromCanvasObject(plantId);
        if (result.status === "error") throw new Error(result.error);
      }

      const baseObjects = replaceExistingSpaces
        ? objects.filter((object) => !(object.type === "space" && object.parentId === activePlot.id))
        : objects;

      const generatedSpaces: CanvasObject[] = buildRectGridObjects({
        objectType: "space",
        originX: activePlot.x,
        originY: activePlot.y,
        rows: layout.rows,
        columns: layout.columns,
        cellWidthPx: layout.cellWidthPx,
        cellHeightPx: layout.cellHeightPx,
        labelPrefix,
        gapXPx: layout.pathwayXPx,
        gapYPx: layout.pathwayYPx,
        gapEveryColumns: layout.pathwayEveryColumns,
        gapEveryRows: layout.pathwayEveryRows,
        parentId: activePlot.id,
      });

      const nextObjects = [...baseObjects, ...generatedSpaces];
      const saveResult = await commands.saveCanvas(
        activeEnvironmentId,
        JSON.stringify({ objects: nextObjects, gridConfig }),
      );
      if (saveResult.status === "error") throw new Error(saveResult.error);

      return {
        nextObjects,
        generatedCount: generatedSpaces.length,
        rows: layout.rows,
        columns: layout.columns,
      };
    },
    onSuccess: ({ nextObjects, generatedCount, rows, columns }) => {
      setObjects(nextObjects);
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["canvas-plants", activeEnvironmentId] });
      void queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({
        color: "green",
        message: `Created ${generatedCount} spaces in a ${rows} x ${columns} grid.`,
      });
      setSubdivideOpen(false);
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Subdivision failed", message: error.message });
    },
  });

  const createPlotGroup = useMutation({
    mutationFn: async () => {
      if (!activeEnvironmentId) throw new Error("No active environment");
      if (!plotGroupName.trim()) throw new Error("Plot group name is required");

      const rows = Number(plotGroupRows);
      const cols = Number(plotGroupCols);
      if (!Number.isInteger(rows) || rows <= 0) throw new Error("Rows must be a whole number > 0");
      if (!Number.isInteger(cols) || cols <= 0) throw new Error("Columns must be a whole number > 0");

      const result = await (commands as any).createPlotGroup({
        environment_id: activeEnvironmentId,
        parent_id: plotGroupSiteId ? Number(plotGroupSiteId) : null,
        name: plotGroupName.trim(),
        label_prefix: plotGroupPrefix.trim() || plotGroupName.trim(),
        rows,
        cols,
        origin_x: null,
        origin_y: null,
        cell_width: gridConfig.spacingPx,
        cell_height: gridConfig.spacingPx,
        gap_x: 0,
        gap_y: 0,
        notes: null,
      });

      if (result.status === "error") throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations", activeEnvironmentId] });
      notifications.show({ color: "green", message: "Plot group created." });
      setCreatePlotGroupOpen(false);
      setPlotGroupName("");
      setPlotGroupPrefix("");
      setPlotGroupRows(2);
      setPlotGroupCols(4);
      setPlotGroupSiteId(null);
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Plot group creation failed", message: error.message });
    },
  });

  const envPlants = useMemo(
    () => allPlants.filter((plant) => plant.environment_id === activeEnvironmentId),
    [activeEnvironmentId, allPlants],
  );
  const speciesById = useMemo(() => new Map(speciesList.map((species) => [species.id, species])), [speciesList]);
  const outdoorSites = useMemo(
    () => hierarchyLocations.filter((location) => location.location_type === "OutdoorSite"),
    [hierarchyLocations],
  );
  const plotGroups = useMemo(
    () => hierarchyLocations.filter((location) => location.location_type === "PlotGroup"),
    [hierarchyLocations],
  );
  const plotGroupSpaceCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const location of hierarchyLocations) {
      if (location.location_type !== "Space" || location.parent_id == null) continue;
      counts.set(location.parent_id, (counts.get(location.parent_id) ?? 0) + 1);
    }
    return counts;
  }, [hierarchyLocations]);
  const canvasPlantsBySpace = useMemo(() => {
    const map = new Map<string, Plant[]>();
    for (const plant of canvasPlants) {
      if (!plant.canvas_object_id) continue;
      const existing = map.get(plant.canvas_object_id);
      if (existing) existing.push(plant);
      else map.set(plant.canvas_object_id, [plant]);
    }
    return map;
  }, [canvasPlants]);

  const plotSummaries = useMemo(
    () => new Map(plots.map((plot) => {
      const spaces = objects.filter((object) => object.type === "space" && object.parentId === plot.id);
      return [plot.id, summarizePlot(spaces, canvasPlantsBySpace)];
    })),
    [canvasPlantsBySpace, objects, plots],
  );
  const activePlotSpaces = useMemo(
    () => objects
      .filter((object) => object.type === "space" && object.parentId === activePlotId)
      .sort((left, right) => left.y - right.y || left.x - right.x),
    [activePlotId, objects],
  );
  const grid = useMemo(() => buildPlotGrid(activePlotSpaces), [activePlotSpaces]);
  const assigningSpace = activePlotSpaces.find((space) => space.id === assigningSpaceId) ?? null;
  const activePlotSummary = summarizePlot(activePlotSpaces, canvasPlantsBySpace);

  if (!activeEnvironmentId) {
    return (
      <Stack p="md">
        <Text c="dimmed">Select an environment in Settings before managing outdoor plots.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Group gap="sm" align="center">
          <IconMap2 size={22} />
          <div>
            <Title order={2}>Outdoor Plot Manager</Title>
            <Text size="sm" c="dimmed">
              Manage garden plots designed in Garden Canvas and assign plants directly to their outdoor spaces.
            </Text>
          </div>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate({ to: "/garden" })}>
          Open Garden Canvas
        </Button>
      </Group>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Title order={4}>Plot Groups</Title>
              <Text size="sm" c="dimmed">
                Database hierarchy for outdoor beds grouped by label prefix.
              </Text>
            </div>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setCreatePlotGroupOpen(true)}>
              Create Plot Group
            </Button>
          </Group>

          {plotGroups.length === 0 ? (
            <Text size="sm" c="dimmed">No plot groups yet.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {plotGroups.map((group) => {
                const site = outdoorSites.find((candidate) => candidate.id === group.parent_id);
                return (
                  <Card key={group.id} withBorder padding="sm" radius="md">
                    <Stack gap={4}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={600} lineClamp={1}>{group.name}</Text>
                        <Badge variant="light" size="xs">{plotGroupSpaceCounts.get(group.id) ?? 0} spaces</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">Prefix: {group.label || "—"}</Text>
                      <Text size="xs" c="dimmed">
                        Site: {site?.name ?? "Unassigned"}
                      </Text>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {plots.length === 0 ? (
        <Box
          p="xl"
          style={{
            textAlign: "center",
            border: "1px dashed var(--mantine-color-default-border)",
            borderRadius: 8,
          }}
        >
          <IconMap2 size={32} color="var(--mantine-color-dimmed)" />
          <Text mt="sm">No outdoor plots found for this environment.</Text>
          <Text size="sm" c="dimmed" mt={4}>
            Create plots and spaces in Garden Canvas first, then return here to manage assignments.
          </Text>
          <Group justify="center" mt="md">
            <Button variant="light" onClick={() => navigate({ to: "/garden" })}>Go to Garden Canvas</Button>
          </Group>
        </Box>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
            {plots.map((plot) => {
              const spaces = objects.filter((object) => object.type === "space" && object.parentId === plot.id);
              const summary = plotSummaries.get(plot.id) ?? summarizePlot(spaces, canvasPlantsBySpace);
              const isActive = plot.id === activePlotId;

              return (
                <Card
                  key={plot.id}
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    borderColor: isActive ? "var(--dirtos-accent)" : undefined,
                    boxShadow: isActive ? "0 0 0 1px var(--dirtos-accent) inset" : undefined,
                  }}
                  onClick={() => setActivePlotId(plot.id)}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Text fw={600} lineClamp={1}>{plot.label || "Unnamed plot"}</Text>
                      <Badge variant="light" size="sm">{summary.occupiedSpaces}/{summary.totalSpaces}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{spaces.length} space{spaces.length === 1 ? "" : "s"}</Text>
                    <Group gap={6}>
                      <Badge size="xs" variant="outline" color="green">{summary.activeCount} active</Badge>
                      <Badge size="xs" variant="outline" color="gray">{summary.plannedCount} planned</Badge>
                      <Badge size="xs" variant="outline" color="yellow">{summary.emptySpaces} empty</Badge>
                    </Group>
                    {plot.notes && <Text size="xs" c="dimmed" lineClamp={2}>{plot.notes}</Text>}
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>

          {activePlot && (
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Group gap="sm">
                  <Title order={3}>{activePlot.label || "Unnamed plot"}</Title>
                  <Badge variant="light">{activePlotSpaces.length} spaces</Badge>
                </Group>
                <Group gap="xs">
                  <Badge variant="light" color="green">{activePlotSummary.activeCount} active</Badge>
                  <Badge variant="light" color="gray">{activePlotSummary.plannedCount} planned</Badge>
                  <Badge variant="light" color="lime">{activePlotSummary.seedlingCount} seedling</Badge>
                  <Badge variant="light" color="yellow">{activePlotSummary.emptySpaces} empty</Badge>
                </Group>
              </Group>

              <Group justify="space-between" wrap="wrap">
                <Text size="sm" c="dimmed">
                  {activePlotSummary.occupiedSpaces} assigned · {grid.rowCount || 0} rows · {grid.columnCount || 0} columns
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconLayoutGridAdd size={14} />}
                  onClick={() => setSubdivideOpen(true)}
                >
                  Auto-generate areas
                </Button>
              </Group>

              {activePlotSpaces.length === 0 ? (
                <Box
                  p="xl"
                  style={{
                    textAlign: "center",
                    border: "1px dashed var(--mantine-color-default-border)",
                    borderRadius: 8,
                  }}
                >
                  <Text>No spaces defined inside this plot yet.</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Use Garden Canvas space editing to divide this plot into assignable outdoor spaces.
                  </Text>
                </Box>
              ) : (
                <ScrollArea>
                  <Stack gap={6}>
                    {Array.from({ length: grid.rowCount }, (_, rowIndex) => (
                      <div
                        key={`row-${rowIndex}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${Math.max(1, grid.columnCount)}, minmax(140px, 1fr))`,
                          gap: 6,
                        }}
                      >
                        {Array.from({ length: Math.max(1, grid.columnCount) }, (_, columnIndex) => {
                          const cell = grid.cells.get(`${rowIndex}:${columnIndex}`);
                          const primarySpace = cell?.spaces[0];
                          const assignedPlants = primarySpace ? canvasPlantsBySpace.get(primarySpace.id) ?? [] : [];
                          const assignedPlant = assignedPlants[0];
                          const species = assignedPlant?.species_id != null ? speciesById.get(assignedPlant.species_id) : undefined;

                          return (
                            <PlotSpaceCard
                              key={`${rowIndex}-${columnIndex}`}
                              space={primarySpace}
                              plant={assignedPlant}
                              species={species}
                              duplicateCount={Math.max(0, (cell?.spaces.length ?? 0) - 1) + Math.max(0, assignedPlants.length - 1)}
                              pixelsPerUnit={gridConfig.pixelsPerUnit}
                              unit={gridConfig.unit}
                              onAssign={() => primarySpace && setAssigningSpaceId(primarySpace.id)}
                              onClear={() => assignedPlant && clearAssignment.mutate(assignedPlant.id)}
                              onOpenPlant={() => assignedPlant && navigate({
                                to: "/plants/individuals/$plantId",
                                params: { plantId: String(assignedPlant.id) },
                              })}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </Stack>
                </ScrollArea>
              )}

              <Text size="xs" c="dimmed">
                Spaces are arranged from their Garden Canvas positions into a management grid for quick assignment and review.
              </Text>
            </Stack>
          )}
        </>
      )}

      {assigningSpace && (
        <PlantAssignmentModal
          opened
          spaceId={assigningSpace.id}
          spaceLabel={assigningSpace.label || undefined}
          targetKindLabel="space"
          currentPlantId={canvasPlantsBySpace.get(assigningSpace.id)?.[0]?.id ?? null}
          onClose={() => setAssigningSpaceId(null)}
          onAssigned={() => {
            void queryClient.invalidateQueries({ queryKey: ["canvas-plants", activeEnvironmentId] });
            void queryClient.invalidateQueries({ queryKey: ["plants-all"] });
            setAssigningSpaceId(null);
          }}
        />
      )}

      {activePlot && (
        <AreaGeneratorModal
          opened={subdivideOpen}
          onClose={() => setSubdivideOpen(false)}
          onGenerate={(input) => subdividePlot.mutate(input)}
          title={`Generate areas in ${activePlot.label || "plot"}`}
          description="Generate planting areas from direct dimensions, target density, or explicit row and column counts."
          unit={gridConfig.unit}
          pixelsPerUnit={gridConfig.pixelsPerUnit}
          containerWidthPx={activePlot.width ?? 0}
          containerHeightPx={activePlot.height ?? 0}
          defaultLabelPrefix="Space"
          loading={subdividePlot.isPending}
          submitLabel="Create areas"
        />
      )}

      {envPlants.length === 0 && plots.length > 0 && (
        <Text size="sm" c="dimmed">
          No plants exist in this environment yet. Create one from an assignment dialog or from the plants workspace.
        </Text>
      )}

      <Modal
        opened={createPlotGroupOpen}
        onClose={() => setCreatePlotGroupOpen(false)}
        title="Create Plot Group"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Group Name"
            required
            value={plotGroupName}
            onChange={(event) => setPlotGroupName(event.currentTarget.value)}
          />
          <TextInput
            label="Label Prefix"
            value={plotGroupPrefix}
            onChange={(event) => setPlotGroupPrefix(event.currentTarget.value)}
            placeholder="Defaults to group name"
          />
          <Select
            label="Outdoor Site"
            placeholder="Unassigned"
            clearable
            value={plotGroupSiteId}
            onChange={setPlotGroupSiteId}
            data={outdoorSites.map((site) => ({ value: String(site.id), label: site.name }))}
          />
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput label="Rows" min={1} value={plotGroupRows} onChange={setPlotGroupRows} />
            <NumberInput label="Columns" min={1} value={plotGroupCols} onChange={setPlotGroupCols} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreatePlotGroupOpen(false)}>Cancel</Button>
            <Button loading={createPlotGroup.isPending} onClick={() => createPlotGroup.mutate()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}