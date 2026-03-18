import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/indoor/")({
  component: IndoorIndex,
});

function IndoorIndex() {
  return (
    <Stack p="md">
      <Title order={2}>Indoor</Title>
      <Text c="dimmed">Indoor gardening & hydroponics — Phase 12</Text>
    </Stack>
  );
}
