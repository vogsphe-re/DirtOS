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

        const objects: ReturnType<typeof useCanvasStore.getState>['objects'] = result.data
          ? (JSON.parse(result.data).objects ?? [])
          : [];
        const gridCfg = result.data ? JSON.parse(result.data).gridConfig : undefined;

        // Restore plant assignments from the DB so the canvas reflects the
        // persisted state even if the canvas JSON blob is out of date.
        const assignResult = await commands.getPlantsForCanvas(environmentId);
        if (assignResult.status === 'ok') {
          const plantByObjectId = new Map(
            assignResult.data
              .filter((p) => p.canvas_object_id != null)
              .map((p) => [p.canvas_object_id!, p.id] as [string, number]),
          );
          for (const obj of objects) {
            const pId = plantByObjectId.get(obj.id);
            if (pId != null) obj.assignedPlantId = pId;
          }
        }

        setObjects(objects);
        if (gridCfg) updateGridConfig(gridCfg);
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
