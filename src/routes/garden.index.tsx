import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/garden/")({
  component: GardenIndex,
});

function GardenIndex() {
  return (
    <Stack p="md">
      <Title order={2}>Garden</Title>
      <Text c="dimmed">2D garden canvas — Phase 4</Text>
    </Stack>
  );
}
