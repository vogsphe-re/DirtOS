import { OBJECT_DEFAULTS, type CanvasObject } from "./types";

const DEFAULT_MAX_OBJECTS = 2500;

export type AreaGenerationMode = "dimensions" | "density" | "grid";

export interface RectGridLayout {
  rows: number;
  columns: number;
  cellWidthPx: number;
  cellHeightPx: number;
  generatedCount: number;
  actualDensityPerSquareUnit?: number;
}

export interface AreaGenerationSettings {
  mode: AreaGenerationMode;
  areaWidthUnits: number;
  areaHeightUnits: number;
  plantingDensity: number;
  rows: number;
  columns: number;
}

export interface AreaGenerationPreset {
  id: string;
  label: string;
  description: string;
  values: Partial<AreaGenerationSettings> & { mode: AreaGenerationMode; labelPrefix?: string };
}

interface GridFromDimensionsInput {
  containerWidthPx: number;
  containerHeightPx: number;
  cellWidthUnits: number;
  cellHeightUnits: number;
  pixelsPerUnit: number;
  maxObjects?: number;
}

interface GridFromDensityInput {
  containerWidthPx: number;
  containerHeightPx: number;
  densityPerSquareUnit: number;
  pixelsPerUnit: number;
  maxObjects?: number;
}

interface GridFromCountsInput {
  containerWidthPx: number;
  containerHeightPx: number;
  rows: number;
  columns: number;
  pixelsPerUnit?: number;
  maxObjects?: number;
}

interface BuildRectGridObjectsInput {
  objectType: "plot" | "space";
  originX: number;
  originY: number;
  rows: number;
  columns: number;
  cellWidthPx: number;
  cellHeightPx: number;
  labelPrefix: string;
  gapXPx?: number;
  gapYPx?: number;
  parentId?: string;
}

interface AreaLayoutInput extends AreaGenerationSettings {
  containerWidthPx: number;
  containerHeightPx: number;
  pixelsPerUnit: number;
  maxObjects?: number;
}

export const AREA_GENERATION_PRESETS: AreaGenerationPreset[] = [
  {
    id: "square-foot",
    label: "Square-Foot Layout",
    description: "One-by-one planting squares suited to square-foot gardening and compact raised beds.",
    values: { mode: "dimensions", areaWidthUnits: 1, areaHeightUnits: 1, labelPrefix: "Square" },
  },
  {
    id: "raised-bed",
    label: "Raised Bed",
    description: "A 2 x 8 cell split that works well for standard rectangular raised beds.",
    values: { mode: "grid", rows: 2, columns: 8, labelPrefix: "Bed" },
  },
  {
    id: "market-garden",
    label: "Market Garden",
    description: "A dense block layout for intensive bed planning and quick crop block assignment.",
    values: { mode: "grid", rows: 4, columns: 12, labelPrefix: "Block" },
  },
  {
    id: "orchard-rows",
    label: "Orchard Rows",
    description: "A long row-oriented pattern for trees, berries, and perennial row systems.",
    values: { mode: "grid", rows: 2, columns: 6, labelPrefix: "Row" },
  },
];

function requirePositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  return value;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a whole number greater than 0.`);
  }

  return value;
}

function ensureObjectCount(rows: number, columns: number, maxObjects: number): number {
  const generatedCount = rows * columns;

  if (generatedCount > maxObjects) {
    throw new Error(`This layout would create ${generatedCount} objects. Reduce the grid size below ${maxObjects}.`);
  }

  return generatedCount;
}

function computeActualDensity(
  rows: number,
  columns: number,
  containerWidthPx: number,
  containerHeightPx: number,
  pixelsPerUnit: number,
): number {
  const widthUnits = containerWidthPx / pixelsPerUnit;
  const heightUnits = containerHeightPx / pixelsPerUnit;
  const areaUnits = widthUnits * heightUnits;

  if (!Number.isFinite(areaUnits) || areaUnits <= 0) {
    return 0;
  }

  return (rows * columns) / areaUnits;
}

function toGridRowLabel(index: number): string {
  let label = "";
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

export function createGridFromCellDimensions({
  containerWidthPx,
  containerHeightPx,
  cellWidthUnits,
  cellHeightUnits,
  pixelsPerUnit,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromDimensionsInput): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveNumber(cellWidthUnits, "Cell width");
  requirePositiveNumber(cellHeightUnits, "Cell height");
  requirePositiveNumber(pixelsPerUnit, "Pixels per unit");

  const cellWidthPx = cellWidthUnits * pixelsPerUnit;
  const cellHeightPx = cellHeightUnits * pixelsPerUnit;
  const columns = Math.floor(containerWidthPx / cellWidthPx);
  const rows = Math.floor(containerHeightPx / cellHeightPx);

  if (columns < 1 || rows < 1) {
    throw new Error("The requested area size does not fit inside the selected plot.");
  }

  return {
    rows,
    columns,
    cellWidthPx,
    cellHeightPx,
    generatedCount: ensureObjectCount(rows, columns, maxObjects),
    actualDensityPerSquareUnit: computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit),
  };
}

export function createGridFromDensity({
  containerWidthPx,
  containerHeightPx,
  densityPerSquareUnit,
  pixelsPerUnit,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromDensityInput): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveNumber(densityPerSquareUnit, "Planting density");
  requirePositiveNumber(pixelsPerUnit, "Pixels per unit");

  const widthUnits = containerWidthPx / pixelsPerUnit;
  const heightUnits = containerHeightPx / pixelsPerUnit;
  const totalArea = widthUnits * heightUnits;
  const targetCount = Math.max(1, Math.round(totalArea * densityPerSquareUnit));

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error("The selected density does not produce a valid grid.");
  }

  if (targetCount > maxObjects) {
    throw new Error(`This density would create about ${targetCount} objects. Reduce it below ${maxObjects} total areas.`);
  }

  const aspectRatio = containerWidthPx / containerHeightPx;
  const columns = Math.max(1, Math.round(Math.sqrt(targetCount * aspectRatio)));
  const rows = Math.max(1, Math.ceil(targetCount / columns));

  return {
    rows,
    columns,
    cellWidthPx: containerWidthPx / columns,
    cellHeightPx: containerHeightPx / rows,
    generatedCount: ensureObjectCount(rows, columns, maxObjects),
    actualDensityPerSquareUnit: computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit),
  };
}

export function createGridFromCounts({
  containerWidthPx,
  containerHeightPx,
  rows,
  columns,
  pixelsPerUnit,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromCountsInput): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveInteger(rows, "Rows");
  requirePositiveInteger(columns, "Columns");

  return {
    rows,
    columns,
    cellWidthPx: containerWidthPx / columns,
    cellHeightPx: containerHeightPx / rows,
    generatedCount: ensureObjectCount(rows, columns, maxObjects),
    actualDensityPerSquareUnit:
      pixelsPerUnit != null
        ? computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit)
        : undefined,
  };
}

export function createAreaLayout({
  containerWidthPx,
  containerHeightPx,
  pixelsPerUnit,
  mode,
  areaWidthUnits,
  areaHeightUnits,
  plantingDensity,
  rows,
  columns,
  maxObjects,
}: AreaLayoutInput): RectGridLayout {
  switch (mode) {
    case "dimensions":
      return createGridFromCellDimensions({
        containerWidthPx,
        containerHeightPx,
        cellWidthUnits: areaWidthUnits,
        cellHeightUnits: areaHeightUnits,
        pixelsPerUnit,
        maxObjects,
      });
    case "density":
      return createGridFromDensity({
        containerWidthPx,
        containerHeightPx,
        densityPerSquareUnit: plantingDensity,
        pixelsPerUnit,
        maxObjects,
      });
    case "grid":
      return createGridFromCounts({
        containerWidthPx,
        containerHeightPx,
        rows,
        columns,
        pixelsPerUnit,
        maxObjects,
      });
    default:
      throw new Error("Invalid area generation mode.");
  }
}

export function buildRectGridObjects({
  objectType,
  originX,
  originY,
  rows,
  columns,
  cellWidthPx,
  cellHeightPx,
  labelPrefix,
  gapXPx = 0,
  gapYPx = 0,
  parentId,
}: BuildRectGridObjectsInput): CanvasObject[] {
  const defaults = OBJECT_DEFAULTS[objectType];
  const prefix = labelPrefix.trim() || (objectType === "plot" ? "Plot" : "Space");
  const generatedCount = ensureObjectCount(rows, columns, DEFAULT_MAX_OBJECTS);

  if (generatedCount < 1) {
    return [];
  }

  const objects: CanvasObject[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      objects.push({
        id: crypto.randomUUID(),
        type: objectType,
        layer: defaults.layer,
        x: originX + columnIndex * (cellWidthPx + gapXPx),
        y: originY + rowIndex * (cellHeightPx + gapYPx),
        width: cellWidthPx,
        height: cellHeightPx,
        fill: defaults.fill,
        stroke: defaults.stroke,
        strokeWidth: defaults.strokeWidth,
        opacity: 1,
        rotation: 0,
        label: `${prefix} ${toGridRowLabel(rowIndex)}${columnIndex + 1}`,
        notes: "",
        parentId: objectType === "space" ? parentId ?? null : undefined,
      });
    }
  }

  return objects;
}