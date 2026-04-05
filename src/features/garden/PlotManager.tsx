import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconLayoutGridAdd, IconPlus, IconRefresh, IconTarget, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useCanvasStore } from './canvasStore';
import { buildRectGridObjects } from './layoutGeneration';
import { generatePlotPrefix } from './plotNameGenerator';
import { OBJECT_DEFAULTS } from './types';

interface PlotManagerProps {
  /** Called to pan/center the stage on an object */
  onFocusObject: (id: string) => void;
}

export function PlotManager({ onFocusObject }: PlotManagerProps) {
  const objects = useCanvasStore((s) => s.objects);
  const addObject = useCanvasStore((s) => s.addObject);
  const setObjects = useCanvasStore((s) => s.setObjects);
  const removeObject = useCanvasStore((s) => s.removeObject);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [plotWidth, setPlotWidth] = useState<number | string>(8);
  const [plotHeight, setPlotHeight] = useState<number | string>(4);
  const [gridRows, setGridRows] = useState<number | string>(1);
  const [gridColumns, setGridColumns] = useState<number | string>(3);
  const [startX, setStartX] = useState<number | string>(2);
  const [startY, setStartY] = useState<number | string>(2);
  const [gapX, setGapX] = useState<number | string>(1);
  const [gapY, setGapY] = useState<number | string>(1);
  const [labelPrefix, setLabelPrefix] = useState('Plot');

  const randomizePrefix = () => {
    setLabelPrefix(generatePlotPrefix(plots.map((p) => p.label)));
  };

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

  const generatePlots = () => {
    try {
      const widthUnits = Number(plotWidth);
      const heightUnits = Number(plotHeight);
      const rows = Number(gridRows);
      const columns = Number(gridColumns);
      const originX = Number(startX) * gridConfig.pixelsPerUnit;
      const originY = Number(startY) * gridConfig.pixelsPerUnit;
      const gapXPx = Number(gapX) * gridConfig.pixelsPerUnit;
      const gapYPx = Number(gapY) * gridConfig.pixelsPerUnit;

      if (!Number.isFinite(widthUnits) || widthUnits <= 0) {
        throw new Error(`Plot width must be greater than 0 ${gridConfig.unit}.`);
      }

      if (!Number.isFinite(heightUnits) || heightUnits <= 0) {
        throw new Error(`Plot height must be greater than 0 ${gridConfig.unit}.`);
      }

      if (!Number.isInteger(rows) || rows <= 0) {
        throw new Error('Rows must be a whole number greater than 0.');
      }

      if (!Number.isInteger(columns) || columns <= 0) {
        throw new Error('Columns must be a whole number greater than 0.');
      }

      if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
        throw new Error('Starting position must be a valid number.');
      }

      if (!Number.isFinite(gapXPx) || gapXPx < 0 || !Number.isFinite(gapYPx) || gapYPx < 0) {
        throw new Error('Plot gaps cannot be negative.');
      }

      const generatedPlots = buildRectGridObjects({
        objectType: 'plot',
        originX,
        originY,
        rows,
        columns,
        cellWidthPx: widthUnits * gridConfig.pixelsPerUnit,
        cellHeightPx: heightUnits * gridConfig.pixelsPerUnit,
        gapXPx,
        gapYPx,
        labelPrefix,
      });

      setObjects([...objects, ...generatedPlots]);
      setSelectedId(generatedPlots[0]?.id ?? null);
      setDirty(true);
      setGeneratorOpen(false);
      notifications.show({
        color: 'green',
        message: `Created ${generatedPlots.length} plots in a ${rows} x ${columns} layout.`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Plot generation failed',
        message: error instanceof Error ? error.message : 'Unable to generate plots.',
      });
    }
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
        <Group gap={2}>
          <Tooltip label="Generate plot grid">
            <ActionIcon size="sm" variant="subtle" onClick={() => setGeneratorOpen(true)}>
              <IconLayoutGridAdd size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Add plot">
            <ActionIcon size="sm" variant="subtle" onClick={createPlot}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
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
        <Stack gap="xs">
          <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={createPlot} fullWidth>
            New plot
          </Button>
          <Button size="xs" variant="default" leftSection={<IconLayoutGridAdd size={12} />} onClick={() => { setGeneratorOpen(true); randomizePrefix(); }} fullWidth>
            Generate plots
          </Button>
        </Stack>
      </Box>

      <Modal
        opened={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        title="Generate plots"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Create a repeated plot layout using plot dimensions and a row-by-column arrangement in {gridConfig.unit}.
          </Text>
          <Group grow>
            <NumberInput
              label={`Plot width (${gridConfig.unit})`}
              value={plotWidth}
              onChange={setPlotWidth}
              min={0.1}
              decimalScale={2}
              required
            />
            <NumberInput
              label={`Plot height (${gridConfig.unit})`}
              value={plotHeight}
              onChange={setPlotHeight}
              min={0.1}
              decimalScale={2}
              required
            />
          </Group>
          <Group grow>
            <NumberInput label="Rows" value={gridRows} onChange={setGridRows} min={1} step={1} required />
            <NumberInput label="Columns" value={gridColumns} onChange={setGridColumns} min={1} step={1} required />
          </Group>
          <Group grow>
            <NumberInput
              label={`Start X (${gridConfig.unit})`}
              value={startX}
              onChange={setStartX}
              decimalScale={2}
            />
            <NumberInput
              label={`Start Y (${gridConfig.unit})`}
              value={startY}
              onChange={setStartY}
              decimalScale={2}
            />
          </Group>
          <Group grow>
            <NumberInput
              label={`Horizontal gap (${gridConfig.unit})`}
              value={gapX}
              onChange={setGapX}
              min={0}
              decimalScale={2}
            />
            <NumberInput
              label={`Vertical gap (${gridConfig.unit})`}
              value={gapY}
              onChange={setGapY}
              min={0}
              decimalScale={2}
            />
          </Group>
          <TextInput
            label="Plot label prefix"
            value={labelPrefix}
            onChange={(event) => setLabelPrefix(event.currentTarget.value)}
            placeholder="Plot"
            rightSection={
              <Tooltip label="Generate random prefix" withArrow>
                <ActionIcon size="sm" variant="subtle" onClick={randomizePrefix}>
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
            }
          />
          <Text size="xs" c="dimmed">
            Preview: {Number(gridRows) || 0} row(s) x {Number(gridColumns) || 0} column(s) starting at {Number(startX) || 0}, {Number(startY) || 0} {gridConfig.unit}.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGeneratorOpen(false)}>Cancel</Button>
            <Button onClick={generatePlots}>Create plots</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
