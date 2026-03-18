import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/issues/")({
  component: IssuesIndex,
});

function IssuesIndex() {
  return (
    <Stack p="md">
      <Title order={2}>Issues</Title>
      <Text c="dimmed">Issue tracker — Phase 6</Text>
    </Stack>
  );
}
