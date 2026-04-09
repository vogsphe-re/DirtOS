import { useCallback, useEffect, useState } from 'react';
import { CanvasObject } from '../types';
import { useCanvasStore } from '../canvasStore';

/** In-memory undo/redo for canvas object snapshots (max 50 steps). */
const undoStack: CanvasObject[][] = [];
const redoStack: CanvasObject[][] = [];
const listeners = new Set<() => void>();

function cloneSnapshot(snapshot: CanvasObject[]): CanvasObject[] {
  return JSON.parse(JSON.stringify(snapshot));
}

function emitHistoryChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function clearCanvasHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  emitHistoryChange();
}

export function useCanvasHistory() {
  const [, setVersion] = useState(0);
  const objects = useCanvasStore((s) => s.objects);
  const setObjects = useCanvasStore((s) => s.setObjects);
  const setDirty = useCanvasStore((s) => s.setDirty);

  useEffect(() => {
    const listener = () => setVersion((version) => version + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const pushSnapshot = useCallback(
    (snapshot: CanvasObject[]) => {
      undoStack.push(cloneSnapshot(snapshot));
      if (undoStack.length > 50) undoStack.shift();
      redoStack.length = 0;
      emitHistoryChange();
    },
    [],
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return false;

    redoStack.push(cloneSnapshot(objects));
    const prev = undoStack.pop()!;
    setObjects(prev);
    setDirty(true);
    emitHistoryChange();

    return true;
  }, [objects, setObjects, setDirty]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return false;

    undoStack.push(cloneSnapshot(objects));
    const next = redoStack.pop()!;
    setObjects(next);
    setDirty(true);
    emitHistoryChange();

    return true;
  }, [objects, setObjects, setDirty]);

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
