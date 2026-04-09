import { ActionIcon, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconLayoutGridAdd, IconPlant, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { AreaGeneratorModal } from './AreaGeneratorModal';
import { buildRectGridObjects, type RectGridLayout } from './layoutGeneration';
import { useCanvasStore } from './canvasStore';
import { OBJECT_DEFAULTS } from './types';

/** Banner + controls shown when in space-editing mode for a specific plot. */
export function SpaceEditor() {
  const [generatorOpen, setGeneratorOpen] = useState(false);
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

  const editingParentId = editingPlotGroupId ?? editingPlotId;
  const parentObject = objects.find((o) => o.id === editingParentId);
  if (!editingParentId || !parentObject) return null;

  const spaces = objects.filter((o) => o.type === 'space' && o.parentId === editingParentId);
  const selectedSpace = objects.find(
    (o) => o.id === selectedId && o.type === 'space' && o.parentId === editingParentId,
  );

  const addSpace = () => {
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

    setObjects(nextObjects);
    setSelectedId(generatedSpaces[0]?.id ?? null);
    setDirty(true);
    setGeneratorOpen(false);
  };

  return (
    <Box
      style={{
        position: 'absolute',
        top: 8,
        left: 62,
        right: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--app-shell-panel)',
        border: '1px solid var(--app-shell-border)',
        borderRadius: 8,
        padding: '6px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Tooltip label="Exit space editing mode">
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={() => {
            setEditingPlotId(null);
            setEditingPlotGroupId(null);
            setSelectedId(null);
            setActiveTool('select');
          }}
        >
          <IconArrowLeft size={14} />
        </ActionIcon>
      </Tooltip>

      <Text size="sm" fw={500}>
        Editing spaces in: <strong>{parentObject.label || 'Unnamed area'}</strong>
      </Text>

      <Text size="xs" c="dimmed">
        {spaces.length} space{spaces.length !== 1 ? 's' : ''} · double-click a space to assign a plant
      </Text>

      <Group ml="auto" gap={6}>
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

      <AreaGeneratorModal
        opened={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={generateSpaces}
        title={`Generate areas in ${parentObject.label || 'area'}`}
        description="Generate spaces directly in the canvas while editing this area. The canvas remains unsaved until you save it."
        unit={gridConfig.unit}
        pixelsPerUnit={gridConfig.pixelsPerUnit}
        containerWidthPx={parentObject.width ?? 0}
        containerHeightPx={parentObject.height ?? 0}
        defaultLabelPrefix={parentObject.type === 'plot-group' ? (parentObject.label || 'Space') : 'Space'}
        submitLabel="Insert areas"
        replaceExistingHelpText="Replacing spaces updates the canvas immediately. Save the canvas when you are ready to persist the layout."
      />
    </Box>
  );
}
