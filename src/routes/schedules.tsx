import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/schedules")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Schedules</Title>
      <Text c="dimmed">Schedules & calendar — Phase 8</Text>
    </Stack>
  ),
});
