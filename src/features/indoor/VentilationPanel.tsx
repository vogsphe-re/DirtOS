import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import type { IndoorDashboardSummary } from "../../lib/bindings";

type Props = {
  summary: IndoorDashboardSummary;
};

export function VentilationPanel({ summary }: Props) {
  const ach = summary.air_exchange_per_hour;
  let level: "low" | "ok" | "high" = "ok";
  if (ach !== null && ach < 20) level = "low";
  if (ach !== null && ach > 80) level = "high";

  const color = level === "ok" ? "green" : level === "low" ? "yellow" : "red";

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Ventilation</Text>
          <Badge color={color} variant="light">
            {level.toUpperCase()}
          </Badge>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Type</Text>
          <Text>{summary.indoor_environment.ventilation_type ?? "-"}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Fan CFM</Text>
          <Text>{summary.indoor_environment.ventilation_cfm ?? "-"}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Air Exchanges / Hour</Text>
          <Text>{ach !== null ? ach.toFixed(1) : "-"}</Text>
        </Group>
      </Stack>
    </Card>
  );
}
