import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { commands } from '../../../lib/bindings';
import { useCanvasStore } from '../canvasStore';

/** Handles saving and loading the canvas state to/from the Tauri backend. */
export function useCanvasPersistence() {
  const objects = useCanvasStore((s) => s.objects);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const setObjects = useCanvasStore((s) => s.setObjects);
  const updateGridConfig = useCanvasStore((s) => s.updateGridConfig);
  const setDirty = useCanvasStore((s) => s.setDirty);

  const saveCanvas = useCallback(
    async (environmentId: number) => {
      try {
        const payload = JSON.stringify({ objects, gridConfig });
        const result = await commands.saveCanvas(environmentId, payload);
        if (result.status !== 'ok') throw new Error(result.error);
        setDirty(false);
        notifications.show({ color: 'green', message: 'Canvas saved' });
      } catch (e) {
        notifications.show({ color: 'red', title: 'Save failed', message: String(e) });
      }
    },
    [objects, gridConfig, setDirty],
  );

  const loadCanvas = useCallback(
    async (environmentId: number) => {
      try {
        const result = await commands.loadCanvas(environmentId);
        if (result.status !== 'ok') throw new Error(result.error);
        if (result.data) {
          const parsed = JSON.parse(result.data);
          if (parsed.objects) setObjects(parsed.objects);
          if (parsed.gridConfig) updateGridConfig(parsed.gridConfig);
        }
        setDirty(false);
      } catch (e) {
        notifications.show({
          color: 'orange',
          title: 'Load failed',
          message: String(e),
        });
      }
    },
    [setObjects, updateGridConfig, setDirty],
  );

  return { saveCanvas, loadCanvas };
}
