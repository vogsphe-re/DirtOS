import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/indoor/$environmentId")({
  component: IndoorEnvironment,
});

function IndoorEnvironment() {
  const { environmentId } = Route.useParams();
  return (
    <Stack p="md">
      <Title order={2}>Indoor Environment #{environmentId}</Title>
      <Text c="dimmed">Indoor grow environment — Phase 12</Text>
    </Stack>
  );
}
