import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconEdit, IconPlus, IconTarget, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useCanvasStore } from './canvasStore';
import { OBJECT_DEFAULTS } from './types';

interface PlotManagerProps {
  /** Called to pan/center the stage on an object */
  onFocusObject: (id: string) => void;
}

export function PlotManager({ onFocusObject }: PlotManagerProps) {
  const objects = useCanvasStore((s) => s.objects);
  const addObject = useCanvasStore((s) => s.addObject);
  const removeObject = useCanvasStore((s) => s.removeObject);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const plots = objects.filter((o) => o.type === 'plot');

  const createPlot = () => {
    const id = crypto.randomUUID();
    const def = OBJECT_DEFAULTS['plot'];
    addObject({
      id,
      type: 'plot',
      layer: def.layer,
      x: 100,
      y: 100,
      width: 200,
      height: 160,
      fill: def.fill,
      stroke: def.stroke,
      strokeWidth: def.strokeWidth,
      opacity: 1,
      rotation: 0,
      label: `Plot ${plots.length + 1}`,
      notes: '',
    });
    setSelectedId(id);
    setDirty(true);
  };

  const startRename = (id: string, currentLabel: string) => {
    setEditingId(id);
    setEditName(currentLabel);
  };

  const commitRename = (id: string) => {
    updateObject(id, { label: editName.trim() || 'Unnamed plot' });
    setEditingId(null);
    setDirty(true);
  };

  const deletePlot = (id: string) => {
    // Remove plot and its child spaces
    objects
      .filter((o) => o.id === id || o.parentId === id)
      .forEach((o) => removeObject(o.id));
    setDirty(true);
  };

  return (
    <Box
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-default)',
      }}
    >
      <Group p="xs" justify="space-between">
        <Text size="sm" fw={600}>
          Plots
        </Text>
        <Tooltip label="Add plot">
          <ActionIcon size="sm" variant="subtle" onClick={createPlot}>
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Divider />

      {plots.length === 0 ? (
        <Box p="xs">
          <Text size="xs" c="dimmed">
            No plots yet. Click + to add one.
          </Text>
        </Box>
      ) : (
        <ScrollArea mah={160}>
          <Stack gap={2} p={4}>
            {plots.map((plot) => (
              <Group key={plot.id} gap={4} wrap="nowrap" px={4} py={2}
                style={{ borderRadius: 4, cursor: 'pointer' }}
                onClick={() => setSelectedId(plot.id)}
              >
                {editingId === plot.id ? (
                  <TextInput
                    size="xs"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.currentTarget.value)}
                    onBlur={() => commitRename(plot.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(plot.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Text size="xs" style={{ flex: 1 }} lineClamp={1}>
                    {plot.label || 'Unnamed plot'}
                  </Text>
                )}

                <Tooltip label="Center view" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={(e) => { e.stopPropagation(); onFocusObject(plot.id); }}
                  >
                    <IconTarget size={12} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Rename" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={(e) => { e.stopPropagation(); startRename(plot.id, plot.label); }}
                  >
                    <IconEdit size={12} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete plot" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={(e) => { e.stopPropagation(); deletePlot(plot.id); }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      )}

      <Box px="xs" pb="xs">
        <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={createPlot} fullWidth>
          New plot
        </Button>
      </Box>
    </Box>
  );
}
