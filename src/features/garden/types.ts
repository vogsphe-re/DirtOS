// ---------------------------------------------------------------------------
// Tool & Object type definitions for the Garden Canvas
// ---------------------------------------------------------------------------

export type ToolType =
  | 'select'
  | 'plot'
  | 'space'
  | 'plant'
  | 'path'
  | 'fence'
  | 'raised-bed'
  | 'potted-plant'
  | 'irrigation'
  | 'tree'
  | 'structure'
  | 'custom'
  | 'text'
  | 'eraser';

export type ObjectType =
  | 'plot-group'
  | 'plot'
  | 'space'
  | 'plant'
  | 'path'
  | 'fence'
  | 'raised-bed'
  | 'potted-plant'
  | 'irrigation'
  | 'tree'
  | 'structure'
  | 'imported-model'
  | 'custom'
  | 'text';

export type LayerName =
  | 'plots'
  | 'paths'
  | 'structures'
  | 'irrigation'
  | 'spaces'
  | 'plants'
  | 'labels';

export const LAYER_ORDER: LayerName[] = [
  'plots',
  'paths',
  'structures',
  'irrigation',
  'spaces',
  'plants',
  'labels',
];

export interface GridConfig {
  /** Canvas pixels per grid cell */
  spacingPx: number;
  snapToGrid: boolean;
  showGrid: boolean;
  unit: 'in' | 'ft' | 'm';
  /** Canvas pixels per real-world unit */
  pixelsPerUnit: number;
}

export interface CanvasObject {
  id: string;
  type: ObjectType;
  layer: LayerName;

  // Position (absolute canvas coordinates)
  x: number;
  y: number;

  // Dimensions (for rect shapes)
  width?: number;
  height?: number;

  // Absolute points list for polylines: [x0,y0,x1,y1,...]
  points?: number[];

  // Radius for circle shapes
  radius?: number;

  // Appearance
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;

  // User metadata
  label: string;
  notes: string;

  // Type-specific metadata
  soilTypeId?: number | null;
  assignedPlantId?: number | null;
  spacing?: number;
  material?: string;
  /** For tree: visual canopy radius in pixels */
  canopyRadius?: number;
  /** For spaces: the id of the parent plot CanvasObject */
  parentId?: string | null;
  /** For imported models */
  modelPath?: string | null;
  modelScale?: number;
  modelRotationY?: number;
  modelRotationX?: number;
  modelRotationZ?: number;
}

export const OBJECT_DEFAULTS: Record<
  ObjectType,
  { fill: string; stroke: string; strokeWidth: number; layer: LayerName }
> = {
  'plot-group': { fill: 'rgba(221,160,221,0.14)', stroke: '#7f4f9b', strokeWidth: 2, layer: 'plots' },
  plot: { fill: 'rgba(144,238,144,0.12)', stroke: '#2d7a2d', strokeWidth: 2, layer: 'plots' },
  space: { fill: 'rgba(173,216,230,0.2)', stroke: '#4a9ebe', strokeWidth: 1, layer: 'spaces' },
  plant: { fill: 'rgba(93, 156, 89, 0.78)', stroke: '#356b36', strokeWidth: 2, layer: 'plants' },
  path: { fill: 'transparent', stroke: '#a0522d', strokeWidth: 3, layer: 'paths' },
  fence: { fill: 'transparent', stroke: '#8b7355', strokeWidth: 2, layer: 'paths' },
  'raised-bed': { fill: 'rgba(205,133,63,0.3)', stroke: '#a0522d', strokeWidth: 3, layer: 'structures' },
  'potted-plant': { fill: 'rgba(139,69,19,0.4)', stroke: '#4a2c0a', strokeWidth: 2, layer: 'plants' },
  irrigation: { fill: 'transparent', stroke: '#1565c0', strokeWidth: 2, layer: 'irrigation' },
  tree: { fill: 'rgba(34,139,34,0.6)', stroke: '#1a5e1a', strokeWidth: 2, layer: 'plants' },
  structure: { fill: 'rgba(128,128,128,0.3)', stroke: '#555555', strokeWidth: 2, layer: 'structures' },
  'imported-model': { fill: 'rgba(125,125,200,0.25)', stroke: '#6b6bb3', strokeWidth: 2, layer: 'structures' },
  custom: { fill: 'rgba(255,165,0,0.2)', stroke: '#cc8800', strokeWidth: 2, layer: 'structures' },
  text: { fill: '#333333', stroke: 'transparent', strokeWidth: 0, layer: 'labels' },
};
