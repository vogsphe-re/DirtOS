import { createFileRoute } from "@tanstack/react-router";
import { Text, Title, Stack } from "@mantine/core";

export const Route = createFileRoute("/issues/$issueId")({
  component: IssueDetail,
});

function IssueDetail() {
  const { issueId } = Route.useParams();
  return (
    <Stack p="md">
      <Title order={2}>Issue #{issueId}</Title>
      <Text c="dimmed">Issue detail — Phase 6</Text>
    </Stack>
  );
}
