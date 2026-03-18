import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/sensors")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Sensors</Title>
      <Text c="dimmed">Soil & sensor monitoring — Phase 10</Text>
    </Stack>
  ),
});
