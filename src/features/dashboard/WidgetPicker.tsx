import { Badge, Button, Group, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { WIDGET_CATALOGUE } from "./types";
import type { WidgetConfig } from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface WidgetPickerProps {
  opened: boolean;
  onClose: () => void;
  onAdd: (config: WidgetConfig) => void;
}

export function WidgetPicker({ opened, onClose, onAdd }: WidgetPickerProps) {
  function handleAdd(meta: (typeof WIDGET_CATALOGUE)[number]) {
    onAdd({
      id: uid(),
      type: meta.type,
      title: meta.label,
      col_span: meta.defaultSpan,
      config: {},
    });
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Widget"
      size="lg"
    >
      <SimpleGrid cols={2} spacing="sm">
        {WIDGET_CATALOGUE.map((meta) => (
          <Button
            key={meta.type}
            variant="default"
            h="auto"
            p="md"
            onClick={() => handleAdd(meta)}
            styles={{ inner: { justifyContent: "flex-start" } }}
          >
            <Stack gap={4} align="flex-start">
              <Group gap={6}>
                <Text fw={600} size="sm">{meta.label}</Text>
                <Badge size="xs" variant="light" color="gray">
                  {meta.defaultSpan === 4 ? "1/3" : meta.defaultSpan === 6 ? "1/2" : "Full"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" ta="left">{meta.description}</Text>
            </Stack>
          </Button>
        ))}
      </SimpleGrid>
    </Modal>
  );
}
