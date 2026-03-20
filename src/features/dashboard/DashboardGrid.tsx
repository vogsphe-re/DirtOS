import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetCard } from "./WidgetCard";
import type { ColSpan, WidgetConfig } from "./types";

// ── Sortable wrapper for a single widget ───────────────────────────────────

interface SortableWidgetProps {
  config: WidgetConfig;
  envId: number;
  isEditMode: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, span: ColSpan) => void;
}

function SortableWidget({
  config,
  envId,
  isEditMode,
  onRemove,
  onResize,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id, disabled: !isEditMode });

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: `span ${config.col_span}`,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 999 : "auto",
      }}
    >
      <WidgetCard
        config={config}
        isEditMode={isEditMode}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        onRemove={onRemove}
        onResize={onResize}
      >
        <WidgetRenderer config={config} envId={envId} />
      </WidgetCard>
    </div>
  );
}

// ── DashboardGrid ──────────────────────────────────────────────────────────

interface DashboardGridProps {
  widgets: WidgetConfig[];
  envId: number;
  isEditMode: boolean;
  onReorder: (updated: WidgetConfig[]) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, span: ColSpan) => void;
}

export function DashboardGrid({
  widgets,
  envId,
  isEditMode,
  onReorder,
  onRemove,
  onResize,
}: DashboardGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      onReorder(arrayMove(widgets, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={widgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {widgets.map((config) => (
            <SortableWidget
              key={config.id}
              config={config}
              envId={envId}
              isEditMode={isEditMode}
              onRemove={onRemove}
              onResize={onResize}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
