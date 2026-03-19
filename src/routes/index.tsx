import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBug,
  IconLeaf,
  IconSeeding,
  IconPlant2,
  IconShovel,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { commands } from "../lib/bindings";
import { useAppStore } from "../stores/appStore";
import { WeatherMiniWidget } from "../features/weather/WeatherMiniWidget";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planned:   { label: "Planned",   color: "blue",   icon: <IconShovel size={18} /> },
  seedling:  { label: "Seedling",  color: "teal",   icon: <IconSeeding size={18} /> },
  active:    { label: "Active",    color: "green",  icon: <IconPlant2 size={18} /> },
  harvested: { label: "Harvested", color: "yellow", icon: <IconLeaf size={18} /> },
  removed:   { label: "Removed",  color: "gray",   icon: <IconX size={18} /> },
  dead:      { label: "Dead",     color: "red",    icon: <IconX size={18} /> },
};

function StatusCard({
  status,
  count,
  onClick,
}: {
  status: string;
  count: number;
  onClick: () => void;
}) {
  const meta = STATUS_META[status] ?? { label: status, color: "gray", icon: <IconLeaf size={18} /> };
  return (
    <Card
      shadow="xs"
      padding="sm"
      radius="sm"
      withBorder
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <Group justify="space-between" mb={4}>
        <Box c={`var(--mantine-color-${meta.color}-5)`}>{meta.icon}</Box>
        <Badge color={meta.color} size="sm" variant="light">
          {meta.label}
        </Badge>
      </Group>
      <Text size="xl" fw={700} lh={1.2}>
        {count}
      </Text>
      <Text size="xs" c="dimmed">
        {meta.label} plant{count !== 1 ? "s" : ""}
      </Text>
    </Card>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants-env", activeEnvId],
    queryFn: async () => {
      if (activeEnvId == null) return [];
      const res = await commands.listPlants(activeEnvId, 1000, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: activeEnvId != null,
  });

  const countsByStatus = plants.reduce<Record<string, number>>((acc, p) => {
    const k = (p.status as string).toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const activeCount = countsByStatus["active"] ?? 0;
  const seedlingCount = countsByStatus["seedling"] ?? 0;

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2}>Dashboard</Title>
          <Text size="sm" c="dimmed">
            {activeEnvId ? `${plants.length} total plants` : "Select an environment in Settings"}
          </Text>
        </Stack>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSeeding size={14} />}
            onClick={() => navigate({ to: "/plants/seedlings" })}
          >
            Seedling planner
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconLeaf size={14} />}
            onClick={() => navigate({ to: "/plants/individuals" })}
          >
            All plants
          </Button>
        </Group>
      </Group>

      {/* Status breakdown */}
      {!isLoading && activeEnvId != null && (
        <>
          <Text size="sm" fw={600}>
            Plant status breakdown
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
            {Object.keys(STATUS_META).map((status) => (
              <StatusCard
                key={status}
                status={status}
                count={countsByStatus[status] ?? 0}
                onClick={() => navigate({ to: "/plants/individuals" })}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      {/* Weather mini-widget */}
      {activeEnvId != null && (
        <WeatherMiniWidget />
      )}

      {/* Health summary */}
      {activeEnvId != null && plants.length > 0 && (
        <Card shadow="xs" padding="sm" radius="sm" withBorder>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Garden health
              </Text>
              <Text size="xs" c="dimmed">
                {plants.length > 0
                  ? `${Math.round((activeCount / plants.length) * 100)}% of plants actively growing`
                  : "No plant data"}
              </Text>
            </Stack>
            <Group gap="sm">
              {seedlingCount > 0 && (
                <Badge
                  color="teal"
                  leftSection={<IconSeeding size={12} />}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate({ to: "/plants/seedlings" })}
                >
                  {seedlingCount} ready to review
                </Badge>
              )}
              <Badge color="gray" leftSection={<IconBug size={12} />}>
                Issues: —
              </Badge>
            </Group>
          </Group>
        </Card>
      )}

      {!activeEnvId && (
        <Box
          p="xl"
          style={{
            textAlign: "center",
            border: "1px dashed var(--mantine-color-default-border)",
            borderRadius: 8,
          }}
        >
          <IconLeaf size={32} color="var(--mantine-color-green-5)" />
          <Text c="dimmed" mt="sm">
            Go to <strong>Settings</strong> to create or select an environment.
          </Text>
          <Button
            mt="sm"
            size="sm"
            variant="light"
            onClick={() => navigate({ to: "/settings" })}
          >
            Open Settings
          </Button>
        </Box>
      )}
    </Stack>
  );
}
