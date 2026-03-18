import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/reports")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Reports</Title>
      <Text c="dimmed">Harvest, genealogy & reporting — Phase 13</Text>
    </Stack>
  ),
});
