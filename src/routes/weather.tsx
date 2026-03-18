import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/weather")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Weather</Title>
      <Text c="dimmed">Weather integration — Phase 9</Text>
    </Stack>
  ),
});
