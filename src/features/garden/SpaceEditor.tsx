import { ActionIcon, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import { useCanvasStore } from './canvasStore';
import { OBJECT_DEFAULTS } from './types';

/** Banner + controls shown when in space-editing mode for a specific plot. */
export function SpaceEditor() {
  const editingPlotId = useCanvasStore((s) => s.editingPlotId);
  const objects = useCanvasStore((s) => s.objects);
  const setEditingPlotId = useCanvasStore((s) => s.setEditingPlotId);
  const addObject = useCanvasStore((s) => s.addObject);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const plot = objects.find((o) => o.id === editingPlotId);
  if (!editingPlotId || !plot) return null;

  const spaces = objects.filter((o) => o.type === 'space' && o.parentId === editingPlotId);

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
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid var(--mantine-color-green-3)',
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
        {spaces.length} space{spaces.length !== 1 ? 's' : ''} · double-click to exit
      </Text>

      <Group ml="auto" gap={6}>
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
          leftSection={<IconPlus size={12} />}
          onClick={addSpace}
        >
          Add space
        </Button>
      </Group>
    </Box>
  );
}
