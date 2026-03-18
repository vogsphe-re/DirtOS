import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/plants")({
  component: () => (
    <Stack p="md">
      <Title order={2}>Plants</Title>
      <Text c="dimmed">Species catalog & individual plants — Phase 3</Text>
    </Stack>
  ),
});
