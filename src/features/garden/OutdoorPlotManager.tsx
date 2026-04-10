import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
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
import { IconArrowLeft, IconEdit, IconExternalLink, IconLayoutGridAdd, IconMap2, IconPlant, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { commands, type Location, type Plant } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Species } from "../plants/types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "../plants/types";
import { AreaGeneratorModal } from "./AreaGeneratorModal";
import { useCanvasStore } from "./canvasStore";
import { buildPlotGroupObjects, buildRectGridObjects, type RectGridLayout } from "./layoutGeneration";
import { PlantAssignmentModal } from "./PlantAssignmentModal";
import { useCanvasPersistence } from "./hooks/useCanvasPersistence";
import { generatePlotPrefix } from "./plotNameGenerator";
import type { CanvasObject } from "./types";

const CANVAS_PLOT_GROUP_LINK_NOTE_PREFIX = "plot-group-location-id:";

function toGridRowLabel(index: number): string {
  let label = "";
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

function plotGroupLinkNote(locationId: number): string {
  return `${CANVAS_PLOT_GROUP_LINK_NOTE_PREFIX}${locationId}`;
}

function readLinkedPlotGroupLocationId(notes?: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/plot-group-location-id:(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePositiveInteger(value: number | string, label: string): number {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a whole number greater than 0.`);
  }

  return parsed;
}

function parsePositiveNumber(value: number | string, label: string): number {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value: number | string, label: string): number {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return parsed;
}

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
  const setSelectedId = useCanvasStore((state) => state.setSelectedId);
  const setEditingPlotId = useCanvasStore((state) => state.setEditingPlotId);
  const setEditingPlotGroupId = useCanvasStore((state) => state.setEditingPlotGroupId);
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
  const [plotGroupSpaceWidth, setPlotGroupSpaceWidth] = useState<number | string>(1);
  const [plotGroupSpaceHeight, setPlotGroupSpaceHeight] = useState<number | string>(1);
  const [plotGroupGapX, setPlotGroupGapX] = useState<number | string>(0);
  const [plotGroupGapY, setPlotGroupGapY] = useState<number | string>(0);
  const [plotGroupStartX, setPlotGroupStartX] = useState<number | string>(1);
  const [plotGroupStartY, setPlotGroupStartY] = useState<number | string>(1);
  const [plotGroupSiteId, setPlotGroupSiteId] = useState<string | null>(null);

  const [editingGroup, setEditingGroup] = useState<Location | null>(null);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupPrefix, setEditGroupPrefix] = useState("");
  const [editGroupRows, setEditGroupRows] = useState<number | string>(2);
  const [editGroupCols, setEditGroupCols] = useState<number | string>(4);
  const [editGroupSiteId, setEditGroupSiteId] = useState<string | null>(null);

  const [groupForCanvasGeneration, setGroupForCanvasGeneration] = useState<Location | null>(null);
  const [generateGroupOpen, setGenerateGroupOpen] = useState(false);
  const [generateGroupRows, setGenerateGroupRows] = useState<number | string>(2);
  const [generateGroupCols, setGenerateGroupCols] = useState<number | string>(4);
  const [generateGroupSpaceWidth, setGenerateGroupSpaceWidth] = useState<number | string>(1);
  const [generateGroupSpaceHeight, setGenerateGroupSpaceHeight] = useState<number | string>(1);
  const [generateGroupGapX, setGenerateGroupGapX] = useState<number | string>(0);
  const [generateGroupGapY, setGenerateGroupGapY] = useState<number | string>(0);
  const [generateGroupStartX, setGenerateGroupStartX] = useState<number | string>(1);
  const [generateGroupStartY, setGenerateGroupStartY] = useState<number | string>(1);
  const [replaceExistingCanvasGroup, setReplaceExistingCanvasGroup] = useState(true);

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

      const rows = parsePositiveInteger(plotGroupRows, "Rows");
      const cols = parsePositiveInteger(plotGroupCols, "Columns");
      const cellWidthUnits = parsePositiveNumber(plotGroupSpaceWidth, "Space width");
      const cellHeightUnits = parsePositiveNumber(plotGroupSpaceHeight, "Space height");
      const gapXUnits = parseNonNegativeNumber(plotGroupGapX, "Horizontal gap");
      const gapYUnits = parseNonNegativeNumber(plotGroupGapY, "Vertical gap");
      const startXUnits = parsePositiveNumber(plotGroupStartX, "Starting X");
      const startYUnits = parsePositiveNumber(plotGroupStartY, "Starting Y");

      const originXPx = startXUnits * gridConfig.pixelsPerUnit;
      const originYPx = startYUnits * gridConfig.pixelsPerUnit;
      const cellWidthPx = cellWidthUnits * gridConfig.pixelsPerUnit;
      const cellHeightPx = cellHeightUnits * gridConfig.pixelsPerUnit;
      const gapXPx = gapXUnits * gridConfig.pixelsPerUnit;
      const gapYPx = gapYUnits * gridConfig.pixelsPerUnit;

      const result = await commands.createPlotGroup({
        environment_id: activeEnvironmentId,
        parent_id: plotGroupSiteId ? Number(plotGroupSiteId) : null,
        name: plotGroupName.trim(),
        label_prefix: plotGroupPrefix.trim() || plotGroupName.trim(),
        rows,
        cols,
        origin_x: originXPx,
        origin_y: originYPx,
        cell_width: cellWidthPx,
        cell_height: cellHeightPx,
        gap_x: gapXPx,
        gap_y: gapYPx,
        notes: null,
      });

      if (result.status === "error") throw new Error(result.error);

      return {
        result: result.data,
        rows,
        columns: cols,
        originXPx,
        originYPx,
        cellWidthPx,
        cellHeightPx,
        gapXPx,
        gapYPx,
      };
    },
    onSuccess: async ({ result, rows, columns, originXPx, originYPx, cellWidthPx, cellHeightPx, gapXPx, gapYPx }) => {
      await generatePlotGroupInCanvas({
        sourceGroup: result.group,
        rows,
        columns,
        originXPx,
        originYPx,
        cellWidthPx,
        cellHeightPx,
        gapXPx,
        gapYPx,
        replaceExisting: true,
      });

      void queryClient.invalidateQueries({ queryKey: ["locations", activeEnvironmentId] });
      notifications.show({ color: "green", message: "Plot group created and generated in Garden Canvas." });
      setCreatePlotGroupOpen(false);
      setPlotGroupName("");
      setPlotGroupPrefix("");
      setPlotGroupRows(2);
      setPlotGroupCols(4);
      setPlotGroupSpaceWidth(1);
      setPlotGroupSpaceHeight(1);
      setPlotGroupGapX(0);
      setPlotGroupGapY(0);
      setPlotGroupStartX(1);
      setPlotGroupStartY(1);
      setPlotGroupSiteId(null);
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Plot group creation failed", message: error.message });
    },
  });

  const generatePlotGroupInCanvas = async ({
    sourceGroup,
    rows,
    columns,
    originXPx,
    originYPx,
    cellWidthPx,
    cellHeightPx,
    gapXPx,
    gapYPx,
    replaceExisting,
  }: {
    sourceGroup: Location;
    rows: number;
    columns: number;
    originXPx: number;
    originYPx: number;
    cellWidthPx: number;
    cellHeightPx: number;
    gapXPx: number;
    gapYPx: number;
    replaceExisting: boolean;
  }): Promise<string> => {
    if (!activeEnvironmentId) throw new Error("No active environment");

    const currentObjects = useCanvasStore.getState().objects;
    const linkedGroup = currentObjects.find(
      (object) => object.type === "plot-group" && readLinkedPlotGroupLocationId(object.notes) === sourceGroup.id,
    );

    const baseObjects = replaceExisting && linkedGroup
      ? currentObjects.filter((object) => object.id !== linkedGroup.id && object.parentId !== linkedGroup.id)
      : currentObjects;

    const sourceName = sourceGroup.name.trim() || "Plot Group";
    const sourcePrefix = (sourceGroup.label?.trim() || sourceName).trim();
    const linkNote = plotGroupLinkNote(sourceGroup.id);

    const { group, members } = buildPlotGroupObjects({
      originX: originXPx,
      originY: originYPx,
      rows,
      columns,
      cellWidthPx,
      cellHeightPx,
      labelPrefix: sourceName,
      childObjectType: "space",
      gapXPx,
      gapYPx,
    });

    const normalizedGroup: CanvasObject = {
      ...group,
      label: sourceName,
      notes: linkNote,
    };

    const normalizedMembers = members.map((space, index) => {
      const rowIndex = Math.floor(index / columns);
      const columnIndex = index % columns;

      return {
        ...space,
        label: `${sourcePrefix} ${toGridRowLabel(rowIndex)}${columnIndex + 1}`,
        notes: linkNote,
      };
    });

    const nextObjects = [...baseObjects, normalizedGroup, ...normalizedMembers];

    const saveResult = await commands.saveCanvas(
      activeEnvironmentId,
      JSON.stringify({ objects: nextObjects, gridConfig }),
    );
    if (saveResult.status === "error") throw new Error(saveResult.error);

    setObjects(nextObjects);
    setSelectedId(normalizedGroup.id);
    setEditingPlotId(null);
    setEditingPlotGroupId(normalizedGroup.id);
    setDirty(false);

    return normalizedGroup.id;
  };

  const updatePlotGroup = useMutation({
    mutationFn: async () => {
      if (!editingGroup) throw new Error("No plot group selected");

      const name = editGroupName.trim();
      if (!name) throw new Error("Group name is required");

      const rows = parsePositiveInteger(editGroupRows, "Rows");
      const cols = parsePositiveInteger(editGroupCols, "Columns");
      const nextPrefix = (editGroupPrefix.trim() || editingGroup.label || name).trim();

      const result = await commands.updateLocation(editingGroup.id, {
        parent_id: editGroupSiteId ? Number(editGroupSiteId) : null,
        location_type: null,
        name,
        label: nextPrefix,
        position_x: null,
        position_y: null,
        width: null,
        height: null,
        canvas_data_json: null,
        notes: null,
        grid_rows: rows,
        grid_cols: cols,
      });

      if (result.status === "error") throw new Error(result.error);
      if (!result.data) throw new Error("Plot group not found");

      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations", activeEnvironmentId] });
      notifications.show({ color: "green", message: "Plot group updated." });
      setEditGroupOpen(false);
      setEditingGroup(null);
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Plot group update failed", message: error.message });
    },
  });

  const deletePlotGroup = useMutation({
    mutationFn: async (group: Location) => {
      const childrenResult = await commands.listChildLocations(group.id);
      if (childrenResult.status === "error") throw new Error(childrenResult.error);

      for (const child of childrenResult.data) {
        const deleteChild = await commands.deleteLocation(child.id);
        if (deleteChild.status === "error") throw new Error(deleteChild.error);
      }

      const result = await commands.deleteLocation(group.id);
      if (result.status === "error") throw new Error(result.error);
      if (!result.data) throw new Error("Plot group not found");

      const linkedGroup = objects.find(
        (object) => object.type === "plot-group" && readLinkedPlotGroupLocationId(object.notes) === group.id,
      );

      if (linkedGroup && activeEnvironmentId != null) {
        const nextObjects = objects.filter(
          (object) => object.id !== linkedGroup.id && object.parentId !== linkedGroup.id,
        );

        const saveResult = await commands.saveCanvas(
          activeEnvironmentId,
          JSON.stringify({ objects: nextObjects, gridConfig }),
        );
        if (saveResult.status === "error") throw new Error(saveResult.error);

        setObjects(nextObjects);
        setDirty(false);
      }

      return group.id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations", activeEnvironmentId] });
      notifications.show({ color: "green", message: "Plot group deleted." });
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Delete failed", message: error.message });
    },
  });

  const generateExistingPlotGroup = useMutation({
    mutationFn: async () => {
      if (!groupForCanvasGeneration) throw new Error("No plot group selected");

      const rows = parsePositiveInteger(generateGroupRows, "Rows");
      const columns = parsePositiveInteger(generateGroupCols, "Columns");
      const cellWidthUnits = parsePositiveNumber(generateGroupSpaceWidth, "Space width");
      const cellHeightUnits = parsePositiveNumber(generateGroupSpaceHeight, "Space height");
      const gapXUnits = parseNonNegativeNumber(generateGroupGapX, "Horizontal gap");
      const gapYUnits = parseNonNegativeNumber(generateGroupGapY, "Vertical gap");
      const startXUnits = parsePositiveNumber(generateGroupStartX, "Starting X");
      const startYUnits = parsePositiveNumber(generateGroupStartY, "Starting Y");

      return generatePlotGroupInCanvas({
        sourceGroup: groupForCanvasGeneration,
        rows,
        columns,
        originXPx: startXUnits * gridConfig.pixelsPerUnit,
        originYPx: startYUnits * gridConfig.pixelsPerUnit,
        cellWidthPx: cellWidthUnits * gridConfig.pixelsPerUnit,
        cellHeightPx: cellHeightUnits * gridConfig.pixelsPerUnit,
        gapXPx: gapXUnits * gridConfig.pixelsPerUnit,
        gapYPx: gapYUnits * gridConfig.pixelsPerUnit,
        replaceExisting: replaceExistingCanvasGroup,
      });
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: "Plot group generated in Garden Canvas." });
      setGenerateGroupOpen(false);
      navigate({ to: "/garden" });
    },
    onError: (error: Error) => {
      notifications.show({ color: "red", title: "Canvas generation failed", message: error.message });
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

  const openCreatePlotGroupModal = () => {
    const existingGroupNames = plotGroups.map((group) => group.name);
    setPlotGroupName(generatePlotPrefix(existingGroupNames));
    setPlotGroupPrefix("");
    setPlotGroupRows(2);
    setPlotGroupCols(4);
    setPlotGroupSpaceWidth(1);
    setPlotGroupSpaceHeight(1);
    setPlotGroupGapX(0);
    setPlotGroupGapY(0);
    setPlotGroupStartX(1);
    setPlotGroupStartY(1);
    setPlotGroupSiteId(null);
    setCreatePlotGroupOpen(true);
  };

  const openEditGroupModal = (group: Location) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupPrefix(group.label ?? group.name);
    setEditGroupRows(group.grid_rows ?? 2);
    setEditGroupCols(group.grid_cols ?? 4);
    setEditGroupSiteId(group.parent_id != null ? String(group.parent_id) : null);
    setEditGroupOpen(true);
  };

  const openGenerateGroupModal = (group: Location) => {
    const rows = Math.max(1, group.grid_rows ?? 2);
    const columns = Math.max(1, group.grid_cols ?? 4);

    const cellWidthUnits = (group.width != null && columns > 0)
      ? group.width / columns / gridConfig.pixelsPerUnit
      : 1;
    const cellHeightUnits = (group.height != null && rows > 0)
      ? group.height / rows / gridConfig.pixelsPerUnit
      : 1;

    setGroupForCanvasGeneration(group);
    setGenerateGroupRows(rows);
    setGenerateGroupCols(columns);
    setGenerateGroupSpaceWidth(Math.max(0.1, Number(cellWidthUnits.toFixed(2))));
    setGenerateGroupSpaceHeight(Math.max(0.1, Number(cellHeightUnits.toFixed(2))));
    setGenerateGroupGapX(0);
    setGenerateGroupGapY(0);
    const startXUnits = group.position_x != null
      ? Number((group.position_x / gridConfig.pixelsPerUnit).toFixed(2))
      : 1;
    const startYUnits = group.position_y != null
      ? Number((group.position_y / gridConfig.pixelsPerUnit).toFixed(2))
      : 1;
    setGenerateGroupStartX(startXUnits > 0 ? startXUnits : 1);
    setGenerateGroupStartY(startYUnits > 0 ? startYUnits : 1);
    setReplaceExistingCanvasGroup(true);
    setGenerateGroupOpen(true);
  };

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
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreatePlotGroupModal}>
              Create Plot Group
            </Button>
          </Group>

          {plotGroups.length === 0 ? (
            <Text size="sm" c="dimmed">No plot groups yet.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {plotGroups.map((group) => {
                const site = outdoorSites.find((candidate) => candidate.id === group.parent_id);
                const linkedCanvasGroup = objects.find(
                  (object) => object.type === "plot-group" && readLinkedPlotGroupLocationId(object.notes) === group.id,
                );
                return (
                  <Card key={group.id} withBorder padding="sm" radius="md">
                    <Stack gap={4}>
                      <Group justify="space-between" wrap="nowrap">
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          p={0}
                          onClick={() => openGenerateGroupModal(group)}
                          style={{ justifyContent: "flex-start", flex: 1, minWidth: 0 }}
                        >
                          <Text fw={600} lineClamp={1}>{group.name}</Text>
                        </Button>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit plot group">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => openEditGroupModal(group)}
                              aria-label="Edit plot group"
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete plot group">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  `Delete plot group \"${group.name}\" and its child spaces?`,
                                );
                                if (confirmed) deletePlotGroup.mutate(group);
                              }}
                              aria-label="Delete plot group"
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                      <Group gap={6}>
                        <Badge variant="light" size="xs">{plotGroupSpaceCounts.get(group.id) ?? 0} spaces</Badge>
                        <Badge variant="outline" size="xs">{group.grid_rows ?? "?"} x {group.grid_cols ?? "?"}</Badge>
                        <Badge variant="outline" color={linkedCanvasGroup ? "green" : "gray"} size="xs">
                          {linkedCanvasGroup ? "In Canvas" : "Not in Canvas"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">Prefix: {group.label || "—"}</Text>
                      <Text size="xs" c="dimmed">
                        Site: {site?.name ?? "Unassigned"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Click the group name to generate or regenerate this layout in Garden Canvas.
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
            description="Randomly generated by default; you can enter your own name."
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
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Space width (${gridConfig.unit})`}
              min={0.1}
              decimalScale={2}
              value={plotGroupSpaceWidth}
              onChange={setPlotGroupSpaceWidth}
            />
            <NumberInput
              label={`Space height (${gridConfig.unit})`}
              min={0.1}
              decimalScale={2}
              value={plotGroupSpaceHeight}
              onChange={setPlotGroupSpaceHeight}
            />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Horizontal gap (${gridConfig.unit})`}
              min={0}
              decimalScale={2}
              value={plotGroupGapX}
              onChange={setPlotGroupGapX}
            />
            <NumberInput
              label={`Vertical gap (${gridConfig.unit})`}
              min={0}
              decimalScale={2}
              value={plotGroupGapY}
              onChange={setPlotGroupGapY}
            />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Start X (${gridConfig.unit})`}
              min={1}
              decimalScale={2}
              value={plotGroupStartX}
              onChange={setPlotGroupStartX}
            />
            <NumberInput
              label={`Start Y (${gridConfig.unit})`}
              min={1}
              decimalScale={2}
              value={plotGroupStartY}
              onChange={setPlotGroupStartY}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            The row and column count will be used to generate this plot group in Garden Canvas using these dimensions and spacing values.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreatePlotGroupOpen(false)}>Cancel</Button>
            <Button loading={createPlotGroup.isPending} onClick={() => createPlotGroup.mutate()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editGroupOpen}
        onClose={() => {
          setEditGroupOpen(false);
          setEditingGroup(null);
        }}
        title="Edit Plot Group"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Group Name"
            required
            value={editGroupName}
            onChange={(event) => setEditGroupName(event.currentTarget.value)}
          />
          <TextInput
            label="Label Prefix"
            value={editGroupPrefix}
            onChange={(event) => setEditGroupPrefix(event.currentTarget.value)}
          />
          <Select
            label="Outdoor Site"
            placeholder="Current site"
            value={editGroupSiteId}
            onChange={setEditGroupSiteId}
            data={outdoorSites.map((site) => ({ value: String(site.id), label: site.name }))}
          />
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput label="Rows" min={1} value={editGroupRows} onChange={setEditGroupRows} />
            <NumberInput label="Columns" min={1} value={editGroupCols} onChange={setEditGroupCols} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setEditGroupOpen(false);
                setEditingGroup(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={updatePlotGroup.isPending} onClick={() => updatePlotGroup.mutate()}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={generateGroupOpen}
        onClose={() => {
          setGenerateGroupOpen(false);
          setGroupForCanvasGeneration(null);
        }}
        title={groupForCanvasGeneration ? `Generate ${groupForCanvasGeneration.name} in Garden Canvas` : "Generate in Garden Canvas"}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Use the plot group row and column values to generate spaces in Garden Canvas.
          </Text>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput label="Rows" min={1} value={generateGroupRows} onChange={setGenerateGroupRows} />
            <NumberInput label="Columns" min={1} value={generateGroupCols} onChange={setGenerateGroupCols} />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Space width (${gridConfig.unit})`}
              min={0.1}
              decimalScale={2}
              value={generateGroupSpaceWidth}
              onChange={setGenerateGroupSpaceWidth}
            />
            <NumberInput
              label={`Space height (${gridConfig.unit})`}
              min={0.1}
              decimalScale={2}
              value={generateGroupSpaceHeight}
              onChange={setGenerateGroupSpaceHeight}
            />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Horizontal gap (${gridConfig.unit})`}
              min={0}
              decimalScale={2}
              value={generateGroupGapX}
              onChange={setGenerateGroupGapX}
            />
            <NumberInput
              label={`Vertical gap (${gridConfig.unit})`}
              min={0}
              decimalScale={2}
              value={generateGroupGapY}
              onChange={setGenerateGroupGapY}
            />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label={`Start X (${gridConfig.unit})`}
              min={1}
              decimalScale={2}
              value={generateGroupStartX}
              onChange={setGenerateGroupStartX}
            />
            <NumberInput
              label={`Start Y (${gridConfig.unit})`}
              min={1}
              decimalScale={2}
              value={generateGroupStartY}
              onChange={setGenerateGroupStartY}
            />
          </SimpleGrid>
          <Checkbox
            checked={replaceExistingCanvasGroup}
            onChange={(event) => setReplaceExistingCanvasGroup(event.currentTarget.checked)}
            label="Replace existing generated canvas group for this plot group"
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setGenerateGroupOpen(false);
                setGroupForCanvasGeneration(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={generateExistingPlotGroup.isPending} onClick={() => generateExistingPlotGroup.mutate()}>
              Generate in canvas
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}