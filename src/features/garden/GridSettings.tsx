import { ActionIcon, NumberInput, Popover, Select, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { IconGrid4x4 } from '@tabler/icons-react';
import { useCanvasStore } from './canvasStore';

export function GridSettings() {
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const updateGridConfig = useCanvasStore((s) => s.updateGridConfig);

  return (
    <Popover width={220} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Tooltip label="Grid settings">
          <ActionIcon variant="subtle" size="sm">
            <IconGrid4x4 size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Grid
          </Text>
          <Switch
            label="Show grid"
            checked={gridConfig.showGrid}
            onChange={(e) => updateGridConfig({ showGrid: e.currentTarget.checked })}
            size="sm"
          />
          <Switch
            label="Snap to grid"
            checked={gridConfig.snapToGrid}
            onChange={(e) => updateGridConfig({ snapToGrid: e.currentTarget.checked })}
            size="sm"
          />
          <NumberInput
            label="Grid cell (px)"
            value={gridConfig.spacingPx}
            onChange={(v) => updateGridConfig({ spacingPx: Number(v) })}
            min={5}
            max={200}
            size="xs"
          />
          <Select
            label="Unit"
            data={[
              { value: 'ft', label: 'Feet' },
              { value: 'm', label: 'Meters' },
              { value: 'in', label: 'Inches' },
            ]}
            value={gridConfig.unit}
            onChange={(v) => updateGridConfig({ unit: v as 'ft' | 'm' | 'in' })}
            size="xs"
          />
          <NumberInput
            label="Pixels per unit"
            value={gridConfig.pixelsPerUnit}
            onChange={(v) => updateGridConfig({ pixelsPerUnit: Number(v) })}
            min={1}
            max={200}
            size="xs"
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
