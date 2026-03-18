import React from 'react';
import { ActionIcon, Box, Divider, Stack, Tooltip } from '@mantine/core';
import {
  IconArrowsMove,
  IconCircleDotted,
  IconDroplet,
  IconEraser,
  IconLetterT,
  IconLine,
  IconPentagon,
  IconPlant,
  IconRectangle,
  IconShovel,
  IconSquare,
  IconTree,
  IconWand,
} from '@tabler/icons-react';
import { useCanvasStore } from './canvasStore';
import type { ToolType } from './types';

interface ToolDef {
  id: ToolType;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select / Move (V)', icon: IconArrowsMove },
  { id: 'plot', label: 'Plot outline (P)', icon: IconPentagon },
  { id: 'space', label: 'Space (S)', icon: IconSquare },
  { id: 'raised-bed', label: 'Raised bed (B)', icon: IconRectangle },
  { id: 'path', label: 'Path (L)', icon: IconLine },
  { id: 'fence', label: 'Fence (F)', icon: IconWand },
  { id: 'irrigation', label: 'Irrigation line (I)', icon: IconDroplet },
  { id: 'tree', label: 'Tree (T)', icon: IconTree },
  { id: 'potted-plant', label: 'Potted plant (O)', icon: IconPlant },
  { id: 'structure', label: 'Structure (R)', icon: IconShovel },
  { id: 'custom', label: 'Custom object (C)', icon: IconCircleDotted },
  { id: 'text', label: 'Text label (X)', icon: IconLetterT },
  { id: 'eraser', label: 'Eraser / Delete (E)', icon: IconEraser },
];

const TOOL_KEYS: Record<string, ToolType> = {
  v: 'select',
  p: 'plot',
  s: 'space',
  b: 'raised-bed',
  l: 'path',
  f: 'fence',
  i: 'irrigation',
  t: 'tree',
  o: 'potted-plant',
  r: 'structure',
  c: 'custom',
  x: 'text',
  e: 'eraser',
};

export function Toolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);

  // Keyboard shortcut handler
  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).tagName === 'INPUT') return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const tool = TOOL_KEYS[ev.key.toLowerCase()];
      if (tool) setActiveTool(tool);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveTool]);

  return (    <Box
      style={{
        width: 52,
        flexShrink: 0,
        background: 'var(--mantine-color-default)',
        borderRight: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 4px',
        gap: 0,
        overflowY: 'auto',
      }}
    >
      <Stack gap={2}>
        {TOOLS.map((tool, idx) => (
          <Box key={tool.id}>
            {/* Visual separator before eraser */}
            {idx === TOOLS.length - 1 && <Divider my={4} />}
            <Tooltip label={tool.label} position="right" withArrow>
              <ActionIcon
                variant={activeTool === tool.id ? 'filled' : 'subtle'}
                color={activeTool === tool.id ? 'green' : 'gray'}
                size="lg"
                onClick={() => setActiveTool(tool.id)}
                aria-label={tool.label}
              >
                <tool.icon size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

