import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/plants/individuals/")({
  component: IndividualsIndex,
});

function IndividualsIndex() {
  return (
    <Stack p="md">
      <Title order={2}>Individual Plants</Title>
      <Text c="dimmed">All individual plants — Phase 3</Text>
    </Stack>
  );
}
