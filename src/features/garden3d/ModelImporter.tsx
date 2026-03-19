import { ActionIcon, Group, NumberInput, Stack, Text, Tooltip } from '@mantine/core';
import { IconCubePlus, IconRotate, IconScale } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useMemo } from 'react';
import { useCanvasStore } from '../garden/canvasStore';
import type { CanvasObject } from '../garden/types';

function asSinglePath(value: string | string[] | null): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isModelObject(obj: CanvasObject): boolean {
  return obj.type === 'imported-model' && !!obj.modelPath;
}

export function ModelImporter() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const addObject = useCanvasStore((s) => s.addObject);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const selectedModel = useMemo(() => {
    const found = objects.find((o) => o.id === selectedId);
    if (!found || !isModelObject(found)) return null;
    return found;
  }, [objects, selectedId]);

  const importModel = async () => {
    const path = asSinglePath(
      await open({
        title: 'Import GLTF/GLB model',
        multiple: false,
        filters: [{ name: '3D Models', extensions: ['gltf', 'glb'] }],
      }),
    );
    if (!path) return;

    const id = `model-${Date.now()}`;
    addObject({
      id,
      type: 'imported-model',
      layer: 'structures',
      x: 120,
      y: 120,
      width: 80,
      height: 80,
      fill: 'rgba(125,125,200,0.25)',
      stroke: '#6b6bb3',
      strokeWidth: 2,
      opacity: 1,
      rotation: 0,
      label: 'Imported Model',
      notes: '',
      modelPath: path,
      modelScale: 1,
      modelRotationY: 0,
      modelRotationX: 0,
      modelRotationZ: 0,
    });
    setSelectedId(id);
    setDirty(true);
  };

  return (
    <Stack gap={6}>
      <Group justify='space-between'>
        <Text size='xs' fw={600}>Model Import</Text>
        <Tooltip label='Import GLTF / GLB'>
          <ActionIcon size='sm' variant='filled' color='indigo' onClick={importModel}>
            <IconCubePlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {selectedModel ? (
        <Stack gap={5}>
          <Text size='xs' c='dimmed' truncate>
            {selectedModel.modelPath}
          </Text>
          <NumberInput
            size='xs'
            label='Scale'
            leftSection={<IconScale size={12} />}
            value={selectedModel.modelScale ?? 1}
            onChange={(v) => {
              updateObject(selectedModel.id, { modelScale: Number(v || 1) });
              setDirty(true);
            }}
            min={0.05}
            max={50}
            step={0.1}
            decimalScale={2}
          />
          <NumberInput
            size='xs'
            label='Rotation Y (deg)'
            leftSection={<IconRotate size={12} />}
            value={selectedModel.modelRotationY ?? 0}
            onChange={(v) => {
              updateObject(selectedModel.id, { modelRotationY: Number(v || 0) });
              setDirty(true);
            }}
            min={-360}
            max={360}
            step={5}
          />
        </Stack>
      ) : (
        <Text size='xs' c='dimmed'>
          Select an imported model to edit transform.
        </Text>
      )}
    </Stack>
  );
}
