import { ActionIcon, Box, Group, Text, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconLayoutSidebar, IconZoomIn, IconZoomOut, IconZoomReset } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { GardenScene } from '../garden3d/GardenScene';
import { ViewToggle, type GardenViewMode } from '../garden3d/ViewToggle';
import { GardenCanvas } from './GardenCanvas';
import { GridSettings } from './GridSettings';
import { LayerPanel } from './LayerPanel';
import { PlotManager } from './PlotManager';
import { PropertiesPanel } from './PropertiesPanel';
import { SpaceEditor } from './SpaceEditor';
import { Toolbar } from './Toolbar';
import { useCanvasStore } from './canvasStore';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';

const RIGHT_PANEL_KEY = 'garden-right-panel';

function readRightPanel(): boolean {
  try {
    const v = localStorage.getItem(RIGHT_PANEL_KEY);
    return v != null ? JSON.parse(v) : true;
  } catch {
    return true;
  }
}

interface GardenPageProps {
  locationId?: string;
}

export function GardenPage({ locationId: _locationId }: GardenPageProps) {
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const stageScale = useCanvasStore((s) => s.stageScale);
  const stageX = useCanvasStore((s) => s.stageX);
  const stageY = useCanvasStore((s) => s.stageY);
  const setStageTransform = useCanvasStore((s) => s.setStageTransform);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const { saveCanvas, loadCanvas } = useCanvasPersistence();

  const [showRight, setShowRight] = useState(readRightPanel);
  const [viewMode, setViewMode] = useState<GardenViewMode>('2d');

  useEffect(() => {
    localStorage.setItem(RIGHT_PANEL_KEY, JSON.stringify(showRight));
  }, [showRight]);

  useEffect(() => {
    if (activeEnvironmentId != null) {
      loadCanvas(activeEnvironmentId);
    }
  }, [activeEnvironmentId, loadCanvas]);

  const handleFocusObject = useCallback(
    (id: string) => {
      const objects = useCanvasStore.getState().objects;
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      setStageTransform(-obj.x * stageScale + 400, -obj.y * stageScale + 300, stageScale);
    },
    [stageScale, setStageTransform],
  );

  const zoomIn = () => setStageTransform(stageX, stageY, Math.min(8, stageScale * 1.2));
  const zoomOut = () => setStageTransform(stageX, stageY, Math.max(0.05, stageScale / 1.2));
  const zoomReset = () => setStageTransform(0, 0, 1);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <Box
        style={{
          height: 40,
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-default)',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text size="sm" fw={500} c="dimmed">
          Garden Canvas
        </Text>
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <Box style={{ flex: 1 }} />
        {viewMode === '2d' && (
          <>
            <Group gap={4}>
              <Tooltip label="Zoom in">
                <ActionIcon size="sm" variant="subtle" onClick={zoomIn}>
                  <IconZoomIn size={15} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" c="dimmed" style={{ minWidth: 40, textAlign: 'center' }}>
                {Math.round(stageScale * 100)}%
              </Text>
              <Tooltip label="Zoom out">
                <ActionIcon size="sm" variant="subtle" onClick={zoomOut}>
                  <IconZoomOut size={15} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Reset zoom">
                <ActionIcon size="sm" variant="subtle" onClick={zoomReset}>
                  <IconZoomReset size={15} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <GridSettings />
          </>
        )}
        <Tooltip label={isDirty ? 'Save canvas (Ctrl+S)' : 'No unsaved changes'}>
          <ActionIcon
            size="sm"
            variant={isDirty ? 'filled' : 'subtle'}
            color={isDirty ? 'green' : 'gray'}
            onClick={() => { if (activeEnvironmentId != null) saveCanvas(activeEnvironmentId); }}
            disabled={activeEnvironmentId == null}
          >
            <IconDeviceFloppy size={15} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Toggle right panel">
          <ActionIcon size="sm" variant="subtle" onClick={() => setShowRight((v) => !v)}>
            <IconLayoutSidebar size={15} />
          </ActionIcon>
        </Tooltip>
      </Box>

      {/* Main area */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {viewMode === '2d' ? (
          <>
            <Toolbar />
            <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <GardenCanvas environmentId={activeEnvironmentId} />
              <SpaceEditor />
            </Box>
          </>
        ) : (
          <Box
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              animation: 'garden3d-fade 180ms ease-out',
            }}
          >
            <GardenScene environmentId={activeEnvironmentId} />
          </Box>
        )}
        {showRight && viewMode === '2d' && (
          <Box
            style={{
              width: 240,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              borderLeft: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <PropertiesPanel />
            <PlotManager onFocusObject={handleFocusObject} />
            <LayerPanel />
          </Box>
        )}
      </Box>
      <style>{`@keyframes garden3d-fade { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: scale(1); } }`}</style>
    </Box>
  );
}

