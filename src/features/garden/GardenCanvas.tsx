import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import { Box, Text as MText } from '@mantine/core';
import { useCanvasStore } from './canvasStore';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';
import { CanvasObject, GridConfig, LAYER_ORDER, OBJECT_DEFAULTS, ObjectType } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativePos(stage: Konva.Stage): { x: number; y: number } {
  const pos = stage.getPointerPosition()!;
  return {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY(),
  };
}

function snapToGrid(
  pos: { x: number; y: number },
  cfg: GridConfig,
): { x: number; y: number } {
  if (!cfg.snapToGrid) return pos;
  const s = cfg.spacingPx;
  return { x: Math.round(pos.x / s) * s, y: Math.round(pos.y / s) * s };
}

function makeObject(type: ObjectType, x: number, y: number, id: string): CanvasObject {
  const def = OBJECT_DEFAULTS[type];
  return {
    id,
    type,
    layer: def.layer,
    x,
    y,
    width: 100,
    height: 60,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    opacity: 1,
    rotation: 0,
    label: '',
    notes: '',
  };
}

const POLYLINE_TOOLS = new Set<string>(['path', 'fence', 'irrigation']);
const CIRCLE_TOOLS = new Set<string>(['potted-plant', 'tree']);

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

const GridLayer = memo(function GridLayer({
  spacing,
  visible,
}: {
  spacing: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const extent = 8000;
  const count = Math.ceil(extent / spacing);
  const lines: ReactElement[] = [];
  for (let i = -count; i <= count; i++) {
    const p = i * spacing;
    lines.push(
      <Line key={`v${i}`} points={[p, -extent, p, extent]}
        stroke="rgba(150,150,150,0.35)" strokeWidth={0.5} listening={false} />,
    );
    lines.push(
      <Line key={`h${i}`} points={[-extent, p, extent, p]}
        stroke="rgba(150,150,150,0.35)" strokeWidth={0.5} listening={false} />,
    );
  }
  return <Layer listening={false}>{lines}</Layer>;
});

// ---------------------------------------------------------------------------
// CanvasShape
// ---------------------------------------------------------------------------

interface CanvasShapeProps {
  obj: CanvasObject;
  isSelected?: boolean;
  onSelect: () => void;
  onDblClick?: () => void;
  onDragEnd: (updates: Partial<CanvasObject>) => void;
  onTransformEnd: (updates: Partial<CanvasObject>) => void;
  draggable: boolean;
}

const CanvasShape = memo(function CanvasShape({
  obj,
  onSelect,
  onDblClick,
  onDragEnd,
  onTransformEnd,
  draggable,
}: CanvasShapeProps) {
  const isPolyline = POLYLINE_TOOLS.has(obj.type);
  const isCircle = CIRCLE_TOOLS.has(obj.type);

  const commonProps = {
    id: obj.id,
    opacity: obj.opacity,
    rotation: obj.rotation,
    onClick: onSelect,
    onTap: onSelect,
    onDblClick: onDblClick,
    onDblTap: onDblClick,
    draggable,
  };

  if (isPolyline) {
    return (
      <Line
        {...commonProps}
        points={obj.points ?? [obj.x, obj.y]}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth}
        dash={obj.type === 'fence' ? [10, 5] : obj.type === 'irrigation' ? [6, 3] : undefined}
        tension={obj.type === 'path' ? 0.3 : 0}
        onDragEnd={(e) => {
          const dx = e.target.x();
          const dy = e.target.y();
          const pts = (obj.points ?? []).map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
          e.target.position({ x: 0, y: 0 });
          onDragEnd({ points: pts });
        }}
      />
    );
  }

  if (isCircle) {
    return (
      <>
        {obj.type === 'tree' && obj.canopyRadius != null && (
          <Circle
            x={obj.x} y={obj.y}
            radius={obj.canopyRadius}
            stroke={obj.stroke} strokeWidth={1}
            dash={[5, 5]} opacity={0.4} listening={false}
          />
        )}
        <Circle
          {...commonProps}
          x={obj.x} y={obj.y}
          radius={obj.radius ?? 20}
          fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth}
          onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
          onTransformEnd={(e) => {
            const node = e.target as Konva.Circle;
            const scaleX = node.scaleX();
            node.scaleX(1); node.scaleY(1);
            onTransformEnd({ x: node.x(), y: node.y(), radius: node.radius() * scaleX });
          }}
        />
      </>
    );
  }

  if (obj.type === 'text') {
    return (
      <Text
        {...commonProps}
        x={obj.x} y={obj.y}
        text={obj.label || 'Text'} fontSize={14}
        fill={obj.fill || '#333'}
        onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
      />
    );
  }

  return (
    <Rect
      {...commonProps}
      x={obj.x} y={obj.y}
      width={obj.width ?? 100} height={obj.height ?? 60}
      fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth}
      cornerRadius={obj.type === 'raised-bed' ? 4 : 0}
      dash={obj.type === 'space' ? [6, 3] : undefined}
      onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Rect;
        const scaleX = node.scaleX(); const scaleY = node.scaleY();
        node.scaleX(1); node.scaleY(1);
        onTransformEnd({
          x: node.x(), y: node.y(),
          width: Math.max(5, node.width() * scaleX),
          height: Math.max(5, node.height() * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
});

// ---------------------------------------------------------------------------
// ObjectLabel
// ---------------------------------------------------------------------------

function ObjectLabel({ obj }: { obj: CanvasObject }) {
  if (!obj.label) return null;
  const isPolyline = POLYLINE_TOOLS.has(obj.type);
  const x = isPolyline ? (obj.points?.[0] ?? obj.x) : obj.x + 4;
  const y = isPolyline ? (obj.points?.[1] ?? obj.y) - 16 : obj.y + 4;
  return (
    <Text x={x} y={y} text={obj.label} fontSize={11} fill="#333" listening={false} />
  );
}

// ---------------------------------------------------------------------------
// Drawing state
// ---------------------------------------------------------------------------

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  isPolyline: boolean;
  polylinePoints: number[];
}

const INIT_DRAW: DrawState = {
  isDrawing: false,
  startX: 0,
  startY: 0,
  isPolyline: false,
  polylinePoints: [],
};

// ---------------------------------------------------------------------------
// GardenCanvas
// ---------------------------------------------------------------------------

export function GardenCanvas({ environmentId }: { environmentId: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [drawState, setDrawState] = useState<DrawState>(INIT_DRAW);
  const [previewObj, setPreviewObj] = useState<CanvasObject | null>(null);
  const [isPanMode, setIsPanMode] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, stageX: 0, stageY: 0 });

  const objects = useCanvasStore((s) => s.objects);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const layerVisibility = useCanvasStore((s) => s.layerVisibility);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const editingPlotId = useCanvasStore((s) => s.editingPlotId);
  const stageX = useCanvasStore((s) => s.stageX);
  const stageY = useCanvasStore((s) => s.stageY);
  const stageScale = useCanvasStore((s) => s.stageScale);
  const isDirty = useCanvasStore((s) => s.isDirty);

  const {
    addObject, updateObject, removeObject,
    setSelectedId, setStageTransform, setDirty,
  } = useCanvasStore();

  const { pushSnapshot, undo, redo } = useCanvasHistory();
  const { saveCanvas, loadCanvas } = useCanvasPersistence();

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load canvas when environment changes
  useEffect(() => {
    if (environmentId != null) loadCanvas(environmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId]);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedId && activeTool === 'select') {
      const node = stage.findOne('#' + selectedId) as Konva.Shape | undefined;
      if (node) tr.nodes([node]);
      else tr.nodes([]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, activeTool, objects]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') setIsPanMode(true);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (environmentId != null) saveCanvas(environmentId);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        pushSnapshot(objects);
        removeObject(selectedId);
        setDirty(true);
      }
      if (e.key === 'Escape') {
        if (drawState.isPolyline) {
          setDrawState(INIT_DRAW); setPreviewObj(null);
        } else {
          setSelectedId(null);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsPanMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, drawState, objects, environmentId]);

  // Wheel zoom
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition()!;
    const factor = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.05, Math.min(8, oldScale * factor));
    const mousePointTo = {
      x: (pointer.x - stageX) / oldScale,
      y: (pointer.y - stageY) / oldScale,
    };
    setStageTransform(
      pointer.x - mousePointTo.x * newScale,
      pointer.y - mousePointTo.y * newScale,
      newScale,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageX, stageY, stageScale]);

  // Mouse down
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const evt = e.evt;
    if (evt.button === 1 || (evt.button === 0 && isPanMode)) {
      setPanStart({ x: evt.clientX, y: evt.clientY, stageX, stageY });
      e.evt.preventDefault();
      return;
    }
    if (evt.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = snapToGrid(getRelativePos(stage), gridConfig);

    if (activeTool === 'select') {
      if (e.target === stage) setSelectedId(null);
      return;
    }
    if (activeTool === 'eraser') return;

    if (POLYLINE_TOOLS.has(activeTool)) {
      if (!drawState.isPolyline) {
        const id = crypto.randomUUID();
        const obj = makeObject(activeTool as ObjectType, 0, 0, id);
        const pts = [pos.x, pos.y, pos.x + 1, pos.y + 1];
        setPreviewObj({ ...obj, points: pts });
        setDrawState({ isDrawing: true, startX: pos.x, startY: pos.y, isPolyline: true, polylinePoints: [pos.x, pos.y] });
      } else {
        setDrawState((prev) => ({
          ...prev,
          polylinePoints: [...prev.polylinePoints, pos.x, pos.y],
        }));
      }
      return;
    }

    const id = crypto.randomUUID();
    const obj = CIRCLE_TOOLS.has(activeTool)
      ? { ...makeObject(activeTool as ObjectType, pos.x, pos.y, id), radius: 1 }
      : { ...makeObject(activeTool as ObjectType, pos.x, pos.y, id), width: 1, height: 1 };
    setPreviewObj(obj);
    setDrawState({ isDrawing: true, startX: pos.x, startY: pos.y, isPolyline: false, polylinePoints: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, isPanMode, drawState, gridConfig, stageX, stageY]);

  // Mouse move
  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current!;

    const rel = getRelativePos(stage);
    setCursor({ x: rel.x, y: rel.y });

    // Pan
    if (e.evt.buttons === 4 || (e.evt.buttons === 1 && isPanMode)) {
      setStageTransform(
        panStart.stageX + (e.evt.clientX - panStart.x),
        panStart.stageY + (e.evt.clientY - panStart.y),
        stageScale,
      );
      return;
    }

    if (!drawState.isDrawing) return;
    const pos = snapToGrid(rel, gridConfig);

    if (drawState.isPolyline) {
      const committed = drawState.polylinePoints;
      setPreviewObj((prev) =>
        prev ? { ...prev, points: [...committed, pos.x, pos.y] } : null,
      );
      return;
    }

    const dx = pos.x - drawState.startX;
    const dy = pos.y - drawState.startY;

    if (previewObj && CIRCLE_TOOLS.has(previewObj.type)) {
      const radius = Math.max(5, Math.sqrt(dx * dx + dy * dy));
      setPreviewObj((prev) =>
        prev ? { ...prev, radius, canopyRadius: prev.type === 'tree' ? radius * 1.5 : undefined } : null,
      );
    } else {
      setPreviewObj((prev) =>
        prev ? {
          ...prev,
          x: dx < 0 ? pos.x : drawState.startX,
          y: dy < 0 ? pos.y : drawState.startY,
          width: Math.abs(dx),
          height: Math.abs(dy),
        } : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawState, isPanMode, panStart, stageScale, gridConfig, previewObj]);

  // Mouse up
  const handleMouseUp = useCallback((_e: KonvaEventObject<MouseEvent>) => {
    if (drawState.isPolyline) return;
    if (!drawState.isDrawing || !previewObj) return;

    const isCircle = CIRCLE_TOOLS.has(previewObj.type);
    const isValid = isCircle
      ? (previewObj.radius ?? 0) > 5
      : (previewObj.width ?? 0) > 5 && (previewObj.height ?? 0) > 5;

    if (isValid) {
      pushSnapshot(objects);
      addObject(previewObj);
      setDirty(true);
    }
    setDrawState(INIT_DRAW);
    setPreviewObj(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawState, previewObj, objects]);

  // Double click — finish polyline or enter plot space-editing mode
  const handleDblClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Finish active polyline
    if (drawState.isPolyline && previewObj) {
      const pts = previewObj.points ?? [];
      if (pts.length >= 4) {
        pushSnapshot(objects);
        addObject({ ...previewObj, points: pts.slice(0, -2) });
        setDirty(true);
      }
      setDrawState(INIT_DRAW);
      setPreviewObj(null);
      return;
    }
    // Exit space editing if clicking outside shapes in edit mode
    if (editingPlotId && e.target === stageRef.current) {
      useCanvasStore.getState().setEditingPlotId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawState, previewObj, objects, editingPlotId]);

  const handleShapeClick = useCallback((obj: CanvasObject) => {
    if (activeTool === 'eraser') {
      pushSnapshot(objects);
      removeObject(obj.id);
      setDirty(true);
      return;
    }
    setSelectedId(obj.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, objects]);

  const handleShapeDblClick = useCallback((obj: CanvasObject) => {
    if (activeTool !== 'select') return;
    if (obj.type === 'plot') {
      useCanvasStore.getState().setEditingPlotId(obj.id);
    } else if (obj.type === 'space' && obj.parentId) {
      useCanvasStore.getState().setEditingPlotId(obj.parentId);
    }
  }, [activeTool]);

  const cursorStyle =
    activeTool === 'select' ? 'default'
    : isPanMode ? 'grab'
    : 'crosshair';

  const visibleObjects = editingPlotId
    ? objects.filter((o) => o.id === editingPlotId || o.parentId === editingPlotId)
    : objects;

  const byLayer = Object.fromEntries(
    LAYER_ORDER.map((l) => [l, visibleObjects.filter((o) => o.layer === l)]),
  ) as Record<string, CanvasObject[]>;

  const coordLabel = `${(cursor.x / gridConfig.pixelsPerUnit).toFixed(1)} ${gridConfig.unit}, ${(cursor.y / gridConfig.pixelsPerUnit).toFixed(1)} ${gridConfig.unit}`;

  return (
    <Box
      ref={containerRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#faf9f6', cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={stageX}
        y={stageY}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
      >
        <GridLayer spacing={gridConfig.spacingPx} visible={gridConfig.showGrid} />

        <Layer>
          {LAYER_ORDER.map((layerName) => (
            <Group
              key={layerName}
              visible={layerVisibility[layerName]}
              listening={layerVisibility[layerName]}
            >
              {byLayer[layerName].map((obj) => (
                <CanvasShape
                  key={obj.id}
                  obj={obj}
                  isSelected={obj.id === selectedId}
                  onSelect={() => handleShapeClick(obj)}
                  onDblClick={() => handleShapeDblClick(obj)}
                  draggable={activeTool === 'select'}
                  onDragEnd={(updates) => {
                    pushSnapshot(objects);
                    updateObject(obj.id, updates);
                    setDirty(true);
                  }}
                  onTransformEnd={(updates) => {
                    updateObject(obj.id, updates);
                    setDirty(true);
                  }}
                />
              ))}
              {byLayer[layerName]
                .filter((o) => o.label && o.type !== 'text')
                .map((o) => (
                  <ObjectLabel key={`lbl-${o.id}`} obj={o} />
                ))}
            </Group>
          ))}

          {previewObj && (
            <CanvasShape
              obj={previewObj}
              isSelected={false}
              onSelect={() => {}}
              draggable={false}
              onDragEnd={() => {}}
              onTransformEnd={() => {}}
            />
          )}

          <Transformer
            ref={trRef}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>

      {/* Coordinate display */}
      <Box
        style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(255,255,255,0.8)', padding: '2px 8px',
          borderRadius: 4, fontSize: 11, color: '#555',
          pointerEvents: 'none', userSelect: 'none',
        }}
      >
        {coordLabel}
      </Box>

      {isDirty && (
        <Box
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(255,200,50,0.9)', padding: '2px 8px',
            borderRadius: 4, fontSize: 11, color: '#555', pointerEvents: 'none',
          }}
        >
          <MText size="xs">Unsaved · Ctrl+S to save</MText>
        </Box>
      )}
    </Box>
  );
}
