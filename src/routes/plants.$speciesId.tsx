import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/plants/$speciesId")({
  component: SpeciesDetail,
});

function SpeciesDetail() {
  const { speciesId } = Route.useParams();
  return (
    <Stack p="md">
      <Title order={2}>Species #{speciesId}</Title>
      <Text c="dimmed">Species detail — Phase 3</Text>
    </Stack>
  );
}
