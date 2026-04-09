import {
  ActionIcon,
  Box,
  ColorInput,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useCanvasStore } from './canvasStore';
import { useCanvasHistory } from './hooks/useCanvasHistory';

export function PropertiesPanel() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const objects = useCanvasStore((s) => s.objects);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const { pushSnapshot } = useCanvasHistory();

  const obj = objects.find((o) => o.id === selectedId);
  if (!obj) return null;

  const update = (changes: Parameters<typeof updateObject>[1]) => {
    pushSnapshot(objects);
    updateObject(obj.id, changes);
    setDirty(true);
  };

  const areaM2 =
    obj.width && obj.height
      ? ((obj.width / 40) * 0.3048 * (obj.height / 40) * 0.3048).toFixed(2)
      : null;

  return (
    <Box
      style={{
        width: 240,
        flexShrink: 0,
        borderLeft: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-default)',
      }}
    >
      <Box
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text size="sm" fw={600} tt="capitalize">
          {obj.type.replace('-', ' ')}
        </Text>
        <Tooltip label="Close">
          <ActionIcon size="sm" variant="subtle" onClick={() => setSelectedId(null)}>
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Box>

      <ScrollArea flex={1} p="xs">
        <Stack gap="xs">
          {/* Label */}
          <TextInput
            label="Label"
            value={obj.label}
            onChange={(e) => update({ label: e.currentTarget.value })}
            size="xs"
          />

          {/* Notes */}
          <Textarea
            label="Notes"
            value={obj.notes}
            onChange={(e) => update({ notes: e.currentTarget.value })}
            rows={2}
            size="xs"
          />

          {/* Position */}
          <Box>
            <Text size="xs" c="dimmed" mb={4}>Position</Text>
            <Box style={{ display: 'flex', gap: 6 }}>
              <NumberInput
                label="X"
                value={Math.round(obj.x)}
                onChange={(v) => update({ x: Number(v) })}
                size="xs"
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Y"
                value={Math.round(obj.y)}
                onChange={(v) => update({ y: Number(v) })}
                size="xs"
                style={{ flex: 1 }}
              />
            </Box>
          </Box>

          {/* Dimensions (rect shapes) */}
          {obj.width != null && obj.height != null && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Dimensions</Text>
              <Box style={{ display: 'flex', gap: 6 }}>
                <NumberInput
                  label="W (px)"
                  value={Math.round(obj.width)}
                  onChange={(v) => update({ width: Number(v) })}
                  size="xs"
                  style={{ flex: 1 }}
                />
                <NumberInput
                  label="H (px)"
                  value={Math.round(obj.height)}
                  onChange={(v) => update({ height: Number(v) })}
                  size="xs"
                  style={{ flex: 1 }}
                />
              </Box>
              {areaM2 && (
                <Text size="xs" c="dimmed" mt={2}>
                  Area: ~{areaM2} m²
                </Text>
              )}
            </Box>
          )}

          {/* Radius (circle shapes) */}
          {obj.radius != null && (
            <NumberInput
              label="Radius (px)"
              value={Math.round(obj.radius)}
              onChange={(v) => update({ radius: Number(v) })}
              size="xs"
            />
          )}

          {/* Canopy radius (tree) */}
          {obj.type === 'tree' && (
            <NumberInput
              label="Canopy radius (px)"
              value={Math.round(obj.canopyRadius ?? 0)}
              onChange={(v) => update({ canopyRadius: Number(v) })}
              size="xs"
            />
          )}

          {/* Rotation */}
          <NumberInput
            label="Rotation (°)"
            value={Math.round(obj.rotation)}
            onChange={(v) => update({ rotation: Number(v) })}
            size="xs"
          />

          {/* Appearance */}
          <Text size="xs" c="dimmed">Appearance</Text>
          <ColorInput
            label="Fill"
            value={obj.fill}
            onChange={(v) => update({ fill: v })}
            format="rgba"
            size="xs"
          />
          <ColorInput
            label="Stroke"
            value={obj.stroke}
            onChange={(v) => update({ stroke: v })}
            size="xs"
          />
          <NumberInput
            label="Stroke width"
            value={obj.strokeWidth}
            onChange={(v) => update({ strokeWidth: Number(v) })}
            min={0}
            max={20}
            size="xs"
          />
          <NumberInput
            label="Opacity"
            value={obj.opacity}
            onChange={(v) => update({ opacity: Number(v) })}
            min={0}
            max={1}
            step={0.05}
            size="xs"
          />

          {/* Type-specific: raised bed material */}
          {obj.type === 'raised-bed' && (
            <TextInput
              label="Material"
              value={obj.material ?? ''}
              onChange={(e) => update({ material: e.currentTarget.value })}
              size="xs"
            />
          )}

          {/* Type-specific: space spacing */}
          {obj.type === 'space' && (
            <NumberInput
              label="Spacing (cm)"
              value={obj.spacing ?? 30}
              onChange={(v) => update({ spacing: Number(v) })}
              size="xs"
            />
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
