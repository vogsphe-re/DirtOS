import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/journal")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Journal</Title>
      <Text c="dimmed">Garden journal & media — Phase 7</Text>
    </Stack>
  ),
});
