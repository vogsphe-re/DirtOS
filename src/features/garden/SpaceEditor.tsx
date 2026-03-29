import { ActionIcon, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconLayoutGridAdd, IconPlant, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { AreaGeneratorModal } from './AreaGeneratorModal';
import { buildRectGridObjects } from './layoutGeneration';
import { useCanvasStore } from './canvasStore';
import { OBJECT_DEFAULTS } from './types';

/** Banner + controls shown when in space-editing mode for a specific plot. */
export function SpaceEditor() {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const editingPlotId = useCanvasStore((s) => s.editingPlotId);
  const objects = useCanvasStore((s) => s.objects);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const setEditingPlotId = useCanvasStore((s) => s.setEditingPlotId);
  const addObject = useCanvasStore((s) => s.addObject);
  const setObjects = useCanvasStore((s) => s.setObjects);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const plot = objects.find((o) => o.id === editingPlotId);
  if (!editingPlotId || !plot) return null;

  const spaces = objects.filter((o) => o.type === 'space' && o.parentId === editingPlotId);
  const selectedSpace = objects.find(
    (o) => o.id === selectedId && o.type === 'space' && o.parentId === editingPlotId,
  );

  const addSpace = () => {
    const id = crypto.randomUUID();
    const def = OBJECT_DEFAULTS['space'];
    addObject({
      id,
      type: 'space',
      layer: def.layer,
      x: (plot.x ?? 0) + 10,
      y: (plot.y ?? 0) + 10,
      width: 40,
      height: 40,
      fill: def.fill,
      stroke: def.stroke,
      strokeWidth: def.strokeWidth,
      opacity: 1,
      rotation: 0,
      label: '',
      notes: '',
      parentId: editingPlotId,
    });
    setSelectedId(id);
    setDirty(true);
  };

  const generateSpaces = async ({
    layout,
    labelPrefix,
    replaceExistingSpaces,
  }: {
    layout: { rows: number; columns: number; cellWidthPx: number; cellHeightPx: number };
    labelPrefix: string;
    replaceExistingSpaces: boolean;
  }) => {
    const generatedSpaces = buildRectGridObjects({
      objectType: 'space',
      originX: plot.x,
      originY: plot.y,
      rows: layout.rows,
      columns: layout.columns,
      cellWidthPx: layout.cellWidthPx,
      cellHeightPx: layout.cellHeightPx,
      labelPrefix,
      parentId: editingPlotId,
    });

    const nextObjects = replaceExistingSpaces
      ? [...objects.filter((object) => !(object.type === 'space' && object.parentId === editingPlotId)), ...generatedSpaces]
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
            setSelectedId(null);
            setActiveTool('select');
          }}
        >
          <IconArrowLeft size={14} />
        </ActionIcon>
      </Tooltip>

      <Text size="sm" fw={500}>
        Editing spaces in: <strong>{plot.label || 'Unnamed plot'}</strong>
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
        title={`Generate areas in ${plot.label || 'plot'}`}
        description="Generate spaces directly in the canvas while editing this plot. The canvas remains unsaved until you save it."
        unit={gridConfig.unit}
        pixelsPerUnit={gridConfig.pixelsPerUnit}
        containerWidthPx={plot.width ?? 0}
        containerHeightPx={plot.height ?? 0}
        defaultLabelPrefix="Space"
        submitLabel="Insert areas"
        replaceExistingHelpText="Replacing spaces updates the canvas immediately. Save the canvas when you are ready to persist the layout."
      />
    </Box>
  );
}
