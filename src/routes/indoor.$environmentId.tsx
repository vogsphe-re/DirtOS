import { createFileRoute } from "@tanstack/react-router";
import { Alert, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { IndoorDashboard } from "../features/indoor/IndoorDashboard";
import { commands } from "../lib/bindings";

export const Route = createFileRoute("/indoor/$environmentId")({
  component: IndoorEnvironment,
});

function IndoorEnvironment() {
  const { environmentId } = Route.useParams();
  const indoorId = Number(environmentId);

  const indoorQuery = useQuery({
    queryKey: ["indoor-environment", indoorId],
    queryFn: async () => {
      const res = await commands.getIndoorEnvironment(indoorId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: Number.isFinite(indoorId),
  });

  return (
    <Stack p="md">
      <Title order={2}>Indoor Environment #{environmentId}</Title>
      {!Number.isFinite(indoorId) && (
        <Alert color="red" title="Invalid indoor environment ID">
          The route parameter is not a valid number.
        </Alert>
      )}
      {indoorQuery.isError && (
        <Alert color="red" title="Unable to load indoor environment">
          {String(indoorQuery.error)}
        </Alert>
      )}
      {!indoorQuery.isError && indoorQuery.data === null && (
        <Text c="dimmed">Indoor environment not found.</Text>
      )}
      {indoorQuery.data && <IndoorDashboard indoorEnvId={indoorId} />}
    </Stack>
  );
}
