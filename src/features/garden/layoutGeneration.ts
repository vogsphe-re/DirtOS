import { OBJECT_DEFAULTS, type CanvasObject } from "./types";

const DEFAULT_MAX_OBJECTS = 2500;

export type AreaGenerationMode = "dimensions" | "density" | "grid";
export type AreaGenerationPresetCategory = "beds" | "blocks" | "orchard" | "nursery";

export interface RectGridLayout {
  rows: number;
  columns: number;
  cellWidthPx: number;
  cellHeightPx: number;
  generatedCount: number;
  pathwayXPx: number;
  pathwayYPx: number;
  pathwayEveryColumns: number;
  pathwayEveryRows: number;
  contentWidthPx: number;
  contentHeightPx: number;
  actualDensityPerSquareUnit?: number;
}

export interface AreaGenerationSettings {
  mode: AreaGenerationMode;
  areaWidthUnits: number;
  areaHeightUnits: number;
  plantingDensity: number;
  rows: number;
  columns: number;
  pathwayWidthXUnits: number;
  pathwayWidthYUnits: number;
  pathwayEveryColumns: number;
  pathwayEveryRows: number;
}

export interface AreaGenerationPreset {
  id: string;
  category: AreaGenerationPresetCategory;
  label: string;
  description: string;
  isPathwayAware?: boolean;
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
  gapEveryColumns?: number;
  gapEveryRows?: number;
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
    category: "beds",
    label: "Square-Foot Layout",
    description: "One-by-one planting squares suited to square-foot gardening and compact raised beds.",
    values: { mode: "dimensions", areaWidthUnits: 1, areaHeightUnits: 1, labelPrefix: "Square" },
  },
  {
    id: "raised-bed",
    category: "beds",
    label: "Raised Bed",
    description: "A 2 x 8 bed split with a central service lane to make tending and harvesting easier.",
    isPathwayAware: true,
    values: {
      mode: "grid",
      rows: 2,
      columns: 8,
      pathwayWidthXUnits: 1,
      pathwayEveryColumns: 4,
      labelPrefix: "Bed",
    },
  },
  {
    id: "market-garden",
    category: "blocks",
    label: "Market Garden",
    description: "Four productive bed rows with narrow walking lanes reserved between each row block.",
    isPathwayAware: true,
    values: {
      mode: "grid",
      rows: 4,
      columns: 12,
      pathwayWidthYUnits: 0.75,
      pathwayEveryRows: 1,
      labelPrefix: "Block",
    },
  },
  {
    id: "orchard-rows",
    category: "orchard",
    label: "Orchard Rows",
    description: "Tree or berry rows with wider maintenance alleys between each planted row.",
    isPathwayAware: true,
    values: {
      mode: "grid",
      rows: 3,
      columns: 6,
      pathwayWidthYUnits: 1.5,
      pathwayEveryRows: 1,
      labelPrefix: "Row",
    },
  },
  {
    id: "nursery-flat",
    category: "nursery",
    label: "Nursery Flat",
    description: "Compact propagation blocks with narrow work lanes suited to nursery staging and hardening areas.",
    isPathwayAware: true,
    values: {
      mode: "grid",
      rows: 5,
      columns: 10,
      pathwayWidthYUnits: 0.5,
      pathwayEveryRows: 2,
      labelPrefix: "Flat",
    },
  },
];

function countInsertedPathways(count: number, every: number): number {
  if (!Number.isInteger(every) || every <= 0 || count <= 1) {
    return 0;
  }

  return Math.floor((count - 1) / every);
}

function requireNonNegativeNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function normalizePathwayEvery(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function getGridCellOffset(index: number, cellSizePx: number, pathwayPx = 0, pathwayEvery = 0): number {
  return index * cellSizePx + countInsertedPathways(index + 1, pathwayEvery) * pathwayPx;
}

export function getGridSpan(count: number, cellSizePx: number, pathwayPx = 0, pathwayEvery = 0): number {
  return count * cellSizePx + countInsertedPathways(count, pathwayEvery) * pathwayPx;
}

function withLayoutMeta(
  layout: Omit<RectGridLayout, "contentWidthPx" | "contentHeightPx" | "pathwayXPx" | "pathwayYPx" | "pathwayEveryColumns" | "pathwayEveryRows">,
  pathwayXPx: number,
  pathwayYPx: number,
  pathwayEveryColumns: number,
  pathwayEveryRows: number,
): RectGridLayout {
  return {
    ...layout,
    pathwayXPx,
    pathwayYPx,
    pathwayEveryColumns,
    pathwayEveryRows,
    contentWidthPx: getGridSpan(layout.columns, layout.cellWidthPx, pathwayXPx, pathwayEveryColumns),
    contentHeightPx: getGridSpan(layout.rows, layout.cellHeightPx, pathwayYPx, pathwayEveryRows),
  };
}

function fitCountWithPathways(availablePx: number, cellPx: number, pathwayPx: number, pathwayEvery: number): number {
  let count = 0;

  while (true) {
    const nextSpan = getGridSpan(count + 1, cellPx, pathwayPx, pathwayEvery);
    if (nextSpan > availablePx + 0.0001) {
      return count;
    }
    count += 1;
  }
}

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
  pathwayWidthXUnits = 0,
  pathwayWidthYUnits = 0,
  pathwayEveryColumns = 0,
  pathwayEveryRows = 0,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromDimensionsInput & Partial<Pick<AreaGenerationSettings, "pathwayWidthXUnits" | "pathwayWidthYUnits" | "pathwayEveryColumns" | "pathwayEveryRows">>): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveNumber(cellWidthUnits, "Cell width");
  requirePositiveNumber(cellHeightUnits, "Cell height");
  requirePositiveNumber(pixelsPerUnit, "Pixels per unit");
  requireNonNegativeNumber(pathwayWidthXUnits, "Horizontal pathway width");
  requireNonNegativeNumber(pathwayWidthYUnits, "Vertical pathway width");

  const cellWidthPx = cellWidthUnits * pixelsPerUnit;
  const cellHeightPx = cellHeightUnits * pixelsPerUnit;
  const pathwayXPx = pathwayWidthXUnits * pixelsPerUnit;
  const pathwayYPx = pathwayWidthYUnits * pixelsPerUnit;
  const normalizedEveryColumns = pathwayXPx > 0 ? normalizePathwayEvery(pathwayEveryColumns) : 0;
  const normalizedEveryRows = pathwayYPx > 0 ? normalizePathwayEvery(pathwayEveryRows) : 0;
  const columns = fitCountWithPathways(containerWidthPx, cellWidthPx, pathwayXPx, normalizedEveryColumns);
  const rows = fitCountWithPathways(containerHeightPx, cellHeightPx, pathwayYPx, normalizedEveryRows);

  if (columns < 1 || rows < 1) {
    throw new Error("The requested area size does not fit inside the selected plot.");
  }

  return withLayoutMeta(
    {
      rows,
      columns,
      cellWidthPx,
      cellHeightPx,
      generatedCount: ensureObjectCount(rows, columns, maxObjects),
      actualDensityPerSquareUnit: computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit),
    },
    pathwayXPx,
    pathwayYPx,
    normalizedEveryColumns,
    normalizedEveryRows,
  );
}

export function createGridFromDensity({
  containerWidthPx,
  containerHeightPx,
  densityPerSquareUnit,
  pixelsPerUnit,
  pathwayWidthXUnits = 0,
  pathwayWidthYUnits = 0,
  pathwayEveryColumns = 0,
  pathwayEveryRows = 0,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromDensityInput & Partial<Pick<AreaGenerationSettings, "pathwayWidthXUnits" | "pathwayWidthYUnits" | "pathwayEveryColumns" | "pathwayEveryRows">>): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveNumber(densityPerSquareUnit, "Planting density");
  requirePositiveNumber(pixelsPerUnit, "Pixels per unit");
  requireNonNegativeNumber(pathwayWidthXUnits, "Horizontal pathway width");
  requireNonNegativeNumber(pathwayWidthYUnits, "Vertical pathway width");

  const widthUnits = containerWidthPx / pixelsPerUnit;
  const heightUnits = containerHeightPx / pixelsPerUnit;
  const totalArea = widthUnits * heightUnits;
  const targetCount = Math.max(1, Math.round(totalArea * densityPerSquareUnit));
  const pathwayXPx = pathwayWidthXUnits * pixelsPerUnit;
  const pathwayYPx = pathwayWidthYUnits * pixelsPerUnit;
  const normalizedEveryColumns = pathwayXPx > 0 ? normalizePathwayEvery(pathwayEveryColumns) : 0;
  const normalizedEveryRows = pathwayYPx > 0 ? normalizePathwayEvery(pathwayEveryRows) : 0;

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error("The selected density does not produce a valid grid.");
  }

  if (targetCount > maxObjects) {
    throw new Error(`This density would create about ${targetCount} objects. Reduce it below ${maxObjects} total areas.`);
  }

  const aspectRatio = containerWidthPx / containerHeightPx;
  const columns = Math.max(1, Math.round(Math.sqrt(targetCount * aspectRatio)));
  const rows = Math.max(1, Math.ceil(targetCount / columns));
  const usableWidthPx = containerWidthPx - countInsertedPathways(columns, normalizedEveryColumns) * pathwayXPx;
  const usableHeightPx = containerHeightPx - countInsertedPathways(rows, normalizedEveryRows) * pathwayYPx;

  if (usableWidthPx <= 0 || usableHeightPx <= 0) {
    throw new Error("The configured walking lanes leave no room for planting areas.");
  }

  return withLayoutMeta(
    {
      rows,
      columns,
      cellWidthPx: usableWidthPx / columns,
      cellHeightPx: usableHeightPx / rows,
      generatedCount: ensureObjectCount(rows, columns, maxObjects),
      actualDensityPerSquareUnit: computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit),
    },
    pathwayXPx,
    pathwayYPx,
    normalizedEveryColumns,
    normalizedEveryRows,
  );
}

export function createGridFromCounts({
  containerWidthPx,
  containerHeightPx,
  rows,
  columns,
  pixelsPerUnit,
  pathwayWidthXUnits = 0,
  pathwayWidthYUnits = 0,
  pathwayEveryColumns = 0,
  pathwayEveryRows = 0,
  maxObjects = DEFAULT_MAX_OBJECTS,
}: GridFromCountsInput & Partial<Pick<AreaGenerationSettings, "pathwayWidthXUnits" | "pathwayWidthYUnits" | "pathwayEveryColumns" | "pathwayEveryRows">>): RectGridLayout {
  requirePositiveNumber(containerWidthPx, "Container width");
  requirePositiveNumber(containerHeightPx, "Container height");
  requirePositiveInteger(rows, "Rows");
  requirePositiveInteger(columns, "Columns");
  requireNonNegativeNumber(pathwayWidthXUnits, "Horizontal pathway width");
  requireNonNegativeNumber(pathwayWidthYUnits, "Vertical pathway width");

  const pathwayXPx = pathwayWidthXUnits * (pixelsPerUnit ?? 0);
  const pathwayYPx = pathwayWidthYUnits * (pixelsPerUnit ?? 0);
  const normalizedEveryColumns = pathwayXPx > 0 ? normalizePathwayEvery(pathwayEveryColumns) : 0;
  const normalizedEveryRows = pathwayYPx > 0 ? normalizePathwayEvery(pathwayEveryRows) : 0;
  const usableWidthPx = containerWidthPx - countInsertedPathways(columns, normalizedEveryColumns) * pathwayXPx;
  const usableHeightPx = containerHeightPx - countInsertedPathways(rows, normalizedEveryRows) * pathwayYPx;

  if (usableWidthPx <= 0 || usableHeightPx <= 0) {
    throw new Error("The configured walking lanes leave no room for planting areas.");
  }

  return withLayoutMeta(
    {
      rows,
      columns,
      cellWidthPx: usableWidthPx / columns,
      cellHeightPx: usableHeightPx / rows,
      generatedCount: ensureObjectCount(rows, columns, maxObjects),
      actualDensityPerSquareUnit:
        pixelsPerUnit != null
          ? computeActualDensity(rows, columns, containerWidthPx, containerHeightPx, pixelsPerUnit)
          : undefined,
    },
    pathwayXPx,
    pathwayYPx,
    normalizedEveryColumns,
    normalizedEveryRows,
  );
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
  pathwayWidthXUnits,
  pathwayWidthYUnits,
  pathwayEveryColumns,
  pathwayEveryRows,
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
        pathwayWidthXUnits,
        pathwayWidthYUnits,
        pathwayEveryColumns,
        pathwayEveryRows,
        maxObjects,
      });
    case "density":
      return createGridFromDensity({
        containerWidthPx,
        containerHeightPx,
        densityPerSquareUnit: plantingDensity,
        pixelsPerUnit,
        pathwayWidthXUnits,
        pathwayWidthYUnits,
        pathwayEveryColumns,
        pathwayEveryRows,
        maxObjects,
      });
    case "grid":
      return createGridFromCounts({
        containerWidthPx,
        containerHeightPx,
        rows,
        columns,
        pixelsPerUnit,
        pathwayWidthXUnits,
        pathwayWidthYUnits,
        pathwayEveryColumns,
        pathwayEveryRows,
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
  gapEveryColumns = 0,
  gapEveryRows = 0,
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
        x: originX + getGridCellOffset(columnIndex, cellWidthPx, gapXPx, gapEveryColumns),
        y: originY + getGridCellOffset(rowIndex, cellHeightPx, gapYPx, gapEveryRows),
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