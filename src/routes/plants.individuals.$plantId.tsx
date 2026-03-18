import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/plants/individuals/$plantId")({
  component: PlantDetail,
});

function PlantDetail() {
  const { plantId } = Route.useParams();
  return (
    <Stack p="md">
      <Title order={2}>Plant #{plantId}</Title>
      <Text c="dimmed">Plant detail — Phase 3</Text>
    </Stack>
  );
}
