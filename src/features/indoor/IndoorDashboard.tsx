import { Alert, Card, Grid, Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { commands } from "../../lib/bindings";
import { HydroponicsPanel } from "./HydroponicsPanel";
import { IndoorCanvasTools } from "./IndoorCanvasTools";
import { IndoorReadings } from "./IndoorReadings";
import { LightSchedule } from "./LightSchedule";
import { VentilationPanel } from "./VentilationPanel";

dayjs.extend(relativeTime);

type Props = {
  indoorEnvId: number;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={2}>
        <Text c="dimmed" size="sm">
          {label}
        </Text>
        <Text fw={700} size="xl">
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

export function IndoorDashboard({ indoorEnvId }: Props) {
  const summaryQuery = useQuery({
    queryKey: ["indoor-dashboard", indoorEnvId],
    queryFn: async () => {
      const res = await commands.getIndoorDashboardSummary(indoorEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  if (summaryQuery.isError) {
    return (
      <Alert color="red" title="Failed to load indoor dashboard">
        {String(summaryQuery.error)}
      </Alert>
    );
  }

  if (!summaryQuery.data) {
    return <Text c="dimmed">Loading indoor dashboard...</Text>;
  }

  const summary = summaryQuery.data;
  const reading = summary.latest_reading;

  return (
    <Stack>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Current VPD"
            value={reading?.vpd !== null && reading?.vpd !== undefined ? `${reading.vpd.toFixed(2)} kPa` : "-"}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Air Temperature"
            value={reading?.air_temp !== null && reading?.air_temp !== undefined ? `${reading.air_temp.toFixed(1)} C` : "-"}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Water pH"
            value={reading?.water_ph !== null && reading?.water_ph !== undefined ? `${reading.water_ph.toFixed(2)}` : "-"}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Days Since Water Change"
            value={
              summary.reservoir_status.days_since_water_change !== null
                ? `${summary.reservoir_status.days_since_water_change}`
                : "-"
            }
          />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <IndoorReadings indoorEnvId={indoorEnvId} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <LightSchedule
              environment={summary.indoor_environment}
              environmentId={summary.location.environment_id}
              locationId={summary.location.id}
            />
            <VentilationPanel summary={summary} />
          </Stack>
        </Grid.Col>
      </Grid>

      <HydroponicsPanel
        indoorEnvId={indoorEnvId}
        environmentId={summary.location.environment_id}
        locationId={summary.location.id}
      />

      <Card withBorder radius="md" p="md">
        <Stack>
          <Group justify="space-between">
            <Text fw={600}>Recent Issues</Text>
            <Text c="dimmed" size="sm">
              {summary.recent_issues.length} linked
            </Text>
          </Group>
          {summary.recent_issues.length === 0 ? (
            <Text c="dimmed" size="sm">
              No recent indoor issues.
            </Text>
          ) : (
            summary.recent_issues.slice(0, 5).map((issue) => (
              <Group justify="space-between" key={issue.id}>
                <Text size="sm">{issue.title}</Text>
                <Text c="dimmed" size="xs">
                  {dayjs(issue.created_at).fromNow()}
                </Text>
              </Group>
            ))
          )}
        </Stack>
      </Card>

      <IndoorCanvasTools
        locationId={summary.location.id}
        widthCm={summary.indoor_environment.tent_width}
        depthCm={summary.indoor_environment.tent_depth}
        lightWattage={summary.indoor_environment.light_wattage}
      />
    </Stack>
  );
}
