import { useCallback, useRef } from 'react';
import { CanvasObject } from '../types';
import { useCanvasStore } from '../canvasStore';

/** In-memory undo/redo for canvas object snapshots (max 50 steps). */
export function useCanvasHistory() {
  const undoStack = useRef<CanvasObject[][]>([]);
  const redoStack = useRef<CanvasObject[][]>([]);
  const objects = useCanvasStore((s) => s.objects);
  const setObjects = useCanvasStore((s) => s.setObjects);

  const pushSnapshot = useCallback(
    (snapshot: CanvasObject[]) => {
      undoStack.current.push(JSON.parse(JSON.stringify(snapshot)));
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
    },
    [],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(JSON.parse(JSON.stringify(objects)));
    const prev = undoStack.current.pop()!;
    setObjects(prev);
  }, [objects, setObjects]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(JSON.parse(JSON.stringify(objects)));
    const next = redoStack.current.pop()!;
    setObjects(next);
  }, [objects, setObjects]);

  return { pushSnapshot, undo, redo };
}
