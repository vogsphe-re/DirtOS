import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/settings")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">App settings & environment — Phase 2</Text>
    </Stack>
  ),
});
