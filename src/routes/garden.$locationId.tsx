import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/garden/$locationId")({
  component: GardenLocation,
});

function GardenLocation() {
  const { locationId } = Route.useParams();
  return (
    <Stack p="md">
      <Title order={2}>Garden — Location {locationId}</Title>
      <Text c="dimmed">Specific plot view — Phase 4</Text>
    </Stack>
  );
}
