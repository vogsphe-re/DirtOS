import { createFileRoute } from "@tanstack/react-router";
import { Alert, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { IndoorSetup } from "../features/indoor/IndoorSetup";
import { commands, type IndoorEnvironmentSummary } from "../lib/bindings";
import { useAppStore } from "../stores/appStore";

export const Route = createFileRoute("/indoor/")({
  component: IndoorIndex,
});

function IndoorIndex() {
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showSetup, setShowSetup] = useState(false);

  const indoorQuery = useQuery<IndoorEnvironmentSummary[]>({
    queryKey: ["indoor-list", activeEnvironmentId],
    queryFn: async () => {
      if (!activeEnvironmentId) return [];
      const res = await commands.listIndoorEnvironments(activeEnvironmentId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvironmentId,
  });

  return (
    <Stack p="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Indoor</Title>
          <Text c="dimmed">Hydroponics and controlled environments</Text>
        </div>
        <Button onClick={() => setShowSetup((v) => !v)}>
          {showSetup ? "Hide Setup" : "Add Indoor Environment"}
        </Button>
      </Group>

      {!activeEnvironmentId && (
        <Alert color="yellow" title="No active environment">
          Select an environment in the sidebar to create or view indoor rooms.
        </Alert>
      )}

      {showSetup && activeEnvironmentId && (
        <IndoorSetup
          environmentId={activeEnvironmentId}
          onCreated={async (value) => {
            setShowSetup(false);
            await queryClient.invalidateQueries({
              queryKey: ["indoor-list", activeEnvironmentId],
            });
            await queryClient.invalidateQueries({
              queryKey: ["indoor-dashboard", value.indoor_environment.id],
            });
          }}
        />
      )}

      {indoorQuery.isError && (
        <Alert color="red" title="Unable to load indoor environments">
          {String(indoorQuery.error)}
        </Alert>
      )}

      {(indoorQuery.data ?? []).map((item) => (
        <Card withBorder key={item.indoor_environment.id}>
          <Group justify="space-between">
            <div>
              <Text fw={600}>{item.location.name}</Text>
              <Text c="dimmed" size="sm">
                {item.indoor_environment.grow_method ?? "Unknown method"}
              </Text>
            </div>
            <Button
              variant="light"
              onClick={() =>
                navigate({
                  to: "/indoor/$environmentId",
                  params: { environmentId: String(item.indoor_environment.id) },
                })
              }
            >
              Open
            </Button>
          </Group>
        </Card>
      ))}

      {indoorQuery.data?.length === 0 && activeEnvironmentId && (
        <Text c="dimmed">No indoor environments yet. Use setup to create one.</Text>
      )}
    </Stack>
  );
}
