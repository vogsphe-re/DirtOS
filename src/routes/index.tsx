import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <Stack p="md">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">Welcome to DirtOS. Your garden at a glance.</Text>
      <Text size="sm" c="dimmed">
        Phase 1 will implement the garden layout canvas and plant bed management.
      </Text>
    </Stack>
  );
}
