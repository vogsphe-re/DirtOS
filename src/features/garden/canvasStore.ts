import type Konva from 'konva';
import { create } from 'zustand';
import { CanvasObject, GridConfig, LayerName, LAYER_ORDER, ToolType } from './types';

export const DEFAULT_GRID: GridConfig = {
  spacingPx: 40,
  snapToGrid: false,
  showGrid: true,
  unit: 'ft',
  pixelsPerUnit: 40,
};

const DEFAULT_LAYER_VISIBILITY: Record<LayerName, boolean> = Object.fromEntries(
  LAYER_ORDER.map((l) => [l, true]),
) as Record<LayerName, boolean>;

interface CanvasStore {
  objects: CanvasObject[];
  activeTool: ToolType;
  selectedId: string | null;
  layerVisibility: Record<LayerName, boolean>;
  gridConfig: GridConfig;
  /** When set, canvas is in space-editing mode for this plot id */
  editingPlotId: string | null;
  /** When set, GardenCanvas should open the plant-assignment modal for this space id */
  pendingPlantAssignId: string | null;
  stageX: number;
  stageY: number;
  stageScale: number;
  stageNode: Konva.Stage | null;
  isDirty: boolean;

  setObjects: (objects: CanvasObject[]) => void;
  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  setActiveTool: (tool: ToolType) => void;
  setSelectedId: (id: string | null) => void;
  toggleLayer: (layer: LayerName) => void;
  updateGridConfig: (config: Partial<GridConfig>) => void;
  setEditingPlotId: (id: string | null) => void;
  setPendingPlantAssignId: (id: string | null) => void;
  setStageTransform: (x: number, y: number, scale: number) => void;
  setStageNode: (stageNode: Konva.Stage | null) => void;
  setDirty: (dirty: boolean) => void;
}

export const useCanvasStore = create<CanvasStore>()((set) => ({
  objects: [],
  activeTool: 'select',
  selectedId: null,
  layerVisibility: DEFAULT_LAYER_VISIBILITY,
  gridConfig: DEFAULT_GRID,
  editingPlotId: null,
  pendingPlantAssignId: null,
  stageX: 0,
  stageY: 0,
  stageScale: 1,
  stageNode: null,
  isDirty: false,

  setObjects: (objects) => set({ objects }),
  addObject: (obj) => set((s) => ({ objects: [...s.objects, obj] })),
  updateObject: (id, updates) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),
  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  setActiveTool: (activeTool) => set({ activeTool }),
  setSelectedId: (selectedId) => set({ selectedId }),
  toggleLayer: (layer) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] },
    })),
  updateGridConfig: (config) =>
    set((s) => ({ gridConfig: { ...s.gridConfig, ...config } })),
  setEditingPlotId: (editingPlotId) => set({ editingPlotId }),
  setPendingPlantAssignId: (pendingPlantAssignId) => set({ pendingPlantAssignId }),
  setStageTransform: (stageX, stageY, stageScale) => set({ stageX, stageY, stageScale }),
  setStageNode: (stageNode) => set({ stageNode }),
  setDirty: (isDirty) => set({ isDirty }),
}));
