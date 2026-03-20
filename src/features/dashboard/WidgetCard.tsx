import {
  ActionIcon,
  Card,
  Group,
  Menu,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowsMove,
  IconDots,
  IconMaximize,
  IconMinimize,
  IconTrash,
} from "@tabler/icons-react";
import type { ColSpan, WidgetConfig } from "./types";

interface WidgetCardProps {
  config: WidgetConfig;
  children: React.ReactNode;
  isEditMode: boolean;
  /** Spread onto the drag-handle element */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, span: ColSpan) => void;
}

const SPAN_CYCLE: Record<ColSpan, ColSpan> = { 4: 6, 6: 12, 12: 4 };
const SPAN_LABELS: Record<ColSpan, string> = { 4: "1/3", 6: "1/2", 12: "Full" };

export function WidgetCard({
  config,
  children,
  isEditMode,
  dragHandleProps,
  isDragging,
  onRemove,
  onResize,
}: WidgetCardProps) {
  return (
    <Card
      withBorder
      shadow="xs"
      p="sm"
      h="100%"
      style={{
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" mb="xs" gap={4} wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ flex: 1, overflow: "hidden" }}>
          {isEditMode && dragHandleProps && (
            <div
              {...dragHandleProps}
              style={{ cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center" }}
            >
              <IconArrowsMove size={14} color="var(--mantine-color-dimmed)" />
            </div>
          )}
          <Text size="sm" fw={600} truncate="end">
            {config.title}
          </Text>
        </Group>

        {isEditMode && (
          <Group gap={4} style={{ flexShrink: 0 }}>
            <Tooltip label={`Size: ${SPAN_LABELS[config.col_span]}`} withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => onResize(config.id, SPAN_CYCLE[config.col_span])}
              >
                {config.col_span === 12
                  ? <IconMinimize size={12} />
                  : <IconMaximize size={12} />}
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray">
                  <IconDots size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={12} />}
                  onClick={() => onRemove(config.id)}
                >
                  Remove widget
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Group>

      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </Card>
  );
}
