import { Box, Divider, Group, Switch, Text } from '@mantine/core';
import { useCanvasStore } from './canvasStore';
import type { LayerName } from './types';
import { LAYER_ORDER } from './types';

const LAYER_LABELS: Record<LayerName, string> = {
  plots: 'Plots',
  paths: 'Paths & Fences',
  structures: 'Structures',
  irrigation: 'Irrigation',
  spaces: 'Spaces',
  plants: 'Plants',
  labels: 'Labels',
};

export function LayerPanel() {
  const layerVisibility = useCanvasStore((s) => s.layerVisibility);
  const toggleLayer = useCanvasStore((s) => s.toggleLayer);

  return (
    <Box
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-default)',
      }}
    >
      <Group p="xs" justify="space-between">
        <Text size="sm" fw={600}>
          Layers
        </Text>
      </Group>
      <Divider />
      <Box px="xs" pb="xs" pt={4}>
        {[...LAYER_ORDER].reverse().map((layer) => (
          <Group key={layer} justify="space-between" py={2} wrap="nowrap">
            <Text size="xs">{LAYER_LABELS[layer]}</Text>
            <Switch
              size="xs"
              checked={layerVisibility[layer]}
              onChange={() => toggleLayer(layer)}
              aria-label={`Toggle ${LAYER_LABELS[layer]} layer`}
            />
          </Group>
        ))}
      </Box>
    </Box>
  );
}
