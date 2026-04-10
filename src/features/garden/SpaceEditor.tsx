import { ActionIcon, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconLayoutGridAdd, IconMinus, IconPlant, IconPlus, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { AreaGeneratorModal } from './AreaGeneratorModal';
import { buildRectGridObjects, type RectGridLayout } from './layoutGeneration';
import { useCanvasStore } from './canvasStore';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { OBJECT_DEFAULTS } from './types';

/** Banner + controls shown when in space-editing mode for a specific plot. */
export function SpaceEditor() {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const editingPlotId = useCanvasStore((s) => s.editingPlotId);
  const editingPlotGroupId = useCanvasStore((s) => s.editingPlotGroupId);
  const objects = useCanvasStore((s) => s.objects);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const setEditingPlotId = useCanvasStore((s) => s.setEditingPlotId);
  const setEditingPlotGroupId = useCanvasStore((s) => s.setEditingPlotGroupId);
  const addObject = useCanvasStore((s) => s.addObject);
  const setObjects = useCanvasStore((s) => s.setObjects);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const { pushSnapshot } = useCanvasHistory();

  const editingParentId = editingPlotGroupId ?? editingPlotId;

  // Reset panel state when the editing target changes
  useEffect(() => {
    setPanelPos(null);
    setMinimized(false);
  }, [editingParentId]);

  const parentObject = objects.find((o) => o.id === editingParentId);
  if (!editingParentId || !parentObject) return null;

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't initiate drag when clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel || !panel.offsetParent) return;

    const panelRect = panel.getBoundingClientRect();
    const parentRect = panel.offsetParent.getBoundingClientRect();

    const startLeft = panelRect.left - parentRect.left;
    const startTop = panelRect.top - parentRect.top;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMouseMove = (me: MouseEvent) => {
      setPanelPos({
        left: startLeft + (me.clientX - startMouseX),
        top: startTop + (me.clientY - startMouseY),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const exitEditing = () => {
    setEditingPlotId(null);
    setEditingPlotGroupId(null);
    setSelectedId(null);
    setActiveTool('select');
  };

  const spaces = objects.filter((o) => o.type === 'space' && o.parentId === editingParentId);
  const selectedSpace = objects.find(
    (o) => o.id === selectedId && o.type === 'space' && o.parentId === editingParentId,
  );

  const addSpace = () => {
    pushSnapshot(objects);

    const id = crypto.randomUUID();
    const def = OBJECT_DEFAULTS['space'];
    addObject({
      id,
      type: 'space',
      layer: def.layer,
      x: (parentObject.x ?? 0) + 10,
      y: (parentObject.y ?? 0) + 10,
      width: 40,
      height: 40,
      fill: def.fill,
      stroke: def.stroke,
      strokeWidth: def.strokeWidth,
      opacity: 1,
      rotation: 0,
      label: '',
      notes: '',
      parentId: editingParentId,
    });
    setSelectedId(id);
    setDirty(true);
  };

  const generateSpaces = async ({
    layout,
    labelPrefix,
    replaceExistingSpaces,
  }: {
    layout: RectGridLayout;
    labelPrefix: string;
    replaceExistingSpaces: boolean;
  }) => {
    const generatedSpaces = buildRectGridObjects({
      objectType: 'space',
      originX: parentObject.x,
      originY: parentObject.y,
      rows: layout.rows,
      columns: layout.columns,
      cellWidthPx: layout.cellWidthPx,
      cellHeightPx: layout.cellHeightPx,
      labelPrefix,
      gapXPx: layout.pathwayXPx,
      gapYPx: layout.pathwayYPx,
      gapEveryColumns: layout.pathwayEveryColumns,
      gapEveryRows: layout.pathwayEveryRows,
      parentId: editingParentId,
    });

    const nextObjects = replaceExistingSpaces
      ? [...objects.filter((object) => !(object.type === 'space' && object.parentId === editingParentId)), ...generatedSpaces]
      : [...objects, ...generatedSpaces];

    pushSnapshot(objects);
    setObjects(nextObjects);
    setSelectedId(generatedSpaces[0]?.id ?? null);
    setDirty(true);
    setGeneratorOpen(false);
  };

  const positionStyle = panelPos
    ? { position: 'absolute' as const, top: panelPos.top, left: panelPos.left }
    : { position: 'absolute' as const, bottom: 16, left: '50%', transform: 'translateX(-50%)' };

  return (
    <>
      <Box
        ref={panelRef}
        onMouseDown={handleDragStart}
        style={{
          ...positionStyle,
          zIndex: 20,
          minWidth: 320,
          maxWidth: 640,
          background: 'var(--app-shell-panel)',
          border: '1px solid var(--app-shell-border)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        {/* Title bar */}
        <Group gap={8} px={10} py={6} wrap="nowrap">
          <Tooltip label="Exit space editing mode">
            <ActionIcon size="sm" variant="subtle" onClick={exitEditing}>
              <IconArrowLeft size={14} />
            </ActionIcon>
          </Tooltip>

          <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
            Editing spaces in: <strong>{parentObject.label || 'Unnamed area'}</strong>
          </Text>

          {!minimized && (
            <Text
              size="xs"
              c="dimmed"
              style={{ whiteSpace: 'nowrap', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {spaces.length} space{spaces.length !== 1 ? 's' : ''} · double-click a space to assign a plant
            </Text>
          )}

          <Group ml="auto" gap={2} style={{ flexShrink: 0 }}>
            <Tooltip label={minimized ? 'Expand panel' : 'Minimize panel'}>
              <ActionIcon size="sm" variant="subtle" onClick={() => setMinimized((v) => !v)}>
                <IconMinus size={11} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Close (exit editing)">
              <ActionIcon size="sm" variant="subtle" onClick={exitEditing}>
                <IconX size={11} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Action buttons — hidden when minimized */}
        {!minimized && (
          <Group
            gap={6}
            px={10}
            pb={8}
            pt={4}
            style={{ borderTop: '1px solid var(--app-shell-border)', flexWrap: 'wrap', cursor: 'default' }}
          >
            {selectedSpace && (
              <Tooltip label={`Assign a plant to "${selectedSpace.label || 'this space'}"`}>
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  leftSection={<IconPlant size={12} />}
                  onClick={() => useCanvasStore.getState().setPendingPlantAssignId(selectedSpace.id)}
                >
                  Assign Plant
                </Button>
              </Tooltip>
            )}
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={() => setActiveTool('space')}
            >
              Draw space
            </Button>
            <Button
              size="xs"
              variant="light"
              color="grape"
              leftSection={<IconLayoutGridAdd size={12} />}
              onClick={() => setGeneratorOpen(true)}
            >
              Generate areas
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={12} />}
              onClick={addSpace}
            >
              Add space
            </Button>
          </Group>
        )}
      </Box>

      <AreaGeneratorModal
        opened={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={generateSpaces}
        title={`Generate areas in ${parentObject.label || 'area'}`}
        description="Generate spaces directly in the canvas while editing this area. Changes are auto-saved."
        unit={gridConfig.unit}
        pixelsPerUnit={gridConfig.pixelsPerUnit}
        containerWidthPx={parentObject.width ?? 0}
        containerHeightPx={parentObject.height ?? 0}
        defaultLabelPrefix={parentObject.type === 'plot-group' ? (parentObject.label || 'Space') : 'Space'}
        submitLabel="Insert areas"
        replaceExistingHelpText="Replacing spaces updates the canvas immediately and the layout is auto-saved."
      />
    </>
  );
}
