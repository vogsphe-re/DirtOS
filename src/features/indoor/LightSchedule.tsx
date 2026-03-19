import { Alert, Button, Card, Group, Select, Stack, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { commands, type IndoorEnvironment } from "../../lib/bindings";
import { listLocationReminders, upsertLocationReminder } from "./reminders";

type Props = {
  environment: IndoorEnvironment;
  environmentId: number;
  locationId: number;
  latestLux?: number | null;
};

function parseHour(time: string | null): number {
  if (!time) return 18;
  const [h, m] = time.split(":").map((n) => Number(n));
  return h + (m || 0) / 60;
}

export function LightSchedule({ environment, environmentId, locationId, latestLux }: Props) {
  const [preset, setPreset] = useState<string>("18/6");

  const hoursOn = useMemo(() => {
    const on = parseHour(environment.light_schedule_on);
    const off = parseHour(environment.light_schedule_off);
    if (off >= on) return off - on;
    return 24 - on + off;
  }, [environment.light_schedule_off, environment.light_schedule_on]);

  const dliEstimateQuery = useQuery({
    queryKey: [
      "indoor-dli",
      environment.id,
      environment.light_wattage,
      environment.light_type,
      hoursOn,
    ],
    queryFn: async () => {
      if (!environment.light_wattage) return null;
      return commands.calculateDli(
        environment.light_wattage,
        environment.light_type,
        45,
        hoursOn,
      );
    },
  });

  const reminderQuery = useQuery({
    queryKey: ["indoor-reminders", environmentId, locationId],
    queryFn: () => listLocationReminders(environmentId, locationId),
  });

  const updateMutation = useMutation({
    mutationFn: async (value: string) => {
      const [onHours] = value.split("/").map((n) => Number(n));
      const on = "06:00";
      const off = `${String((6 + onHours) % 24).padStart(2, "0")}:00`;

      const res = await commands.updateIndoorEnvironment(environment.id, {
        grow_method: null,
        light_type: null,
        light_wattage: null,
        light_schedule_on: on,
        light_schedule_off: off,
        ventilation_type: null,
        ventilation_cfm: null,
        tent_width: null,
        tent_depth: null,
        tent_height: null,
        reservoir_capacity_liters: null,
        notes: null,
      });
      if (res.status === "error") throw new Error(res.error);

      await upsertLocationReminder({
        environmentId,
        locationId,
        scheduleType: "custom",
        title: `Light cycle check (${value})`,
        cronExpression: "0 6 * * *",
        notes: `Daily reminder to verify lights follow ${value} cycle.`,
      });

      return true;
    },
    onSuccess: async () => {
      await reminderQuery.refetch();
    },
  });

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Text fw={600}>Light Schedule</Text>
        <Group justify="space-between">
          <Text c="dimmed">On</Text>
          <Text>{environment.light_schedule_on ?? "-"}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Off</Text>
          <Text>{environment.light_schedule_off ?? "-"}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Photoperiod</Text>
          <Text>{hoursOn.toFixed(1)} h/day</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">Estimated DLI</Text>
          <Text>{dliEstimateQuery.data !== null && dliEstimateQuery.data !== undefined ? dliEstimateQuery.data.toFixed(2) : "-"}</Text>
        </Group>
        {latestLux !== undefined && (
          <Group justify="space-between">
            <Text c="dimmed">Latest Lux</Text>
            <Text>{latestLux ?? "-"}</Text>
          </Group>
        )}

        <Group grow>
          <Select
            label="Cycle Preset"
            value={preset}
            data={[
              { value: "20/4", label: "20/4 Seedling" },
              { value: "18/6", label: "18/6 Vegetative" },
              { value: "12/12", label: "12/12 Flowering" },
              { value: "24/0", label: "24/0 Constant" },
            ]}
            onChange={(v) => setPreset(v ?? "18/6")}
          />
        </Group>

        <Group justify="flex-end">
          <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate(preset)}>
            Apply Preset + Create Reminder
          </Button>
        </Group>

        <Stack gap={4}>
          <Text size="sm" fw={500}>Existing Reminders</Text>
          {reminderQuery.data?.length ? (
            reminderQuery.data.map((s) => (
              <Group key={s.id} justify="space-between">
                <Text size="sm">{s.title}</Text>
                <Text size="xs" c="dimmed">{s.next_run_at ?? "No next run"}</Text>
              </Group>
            ))
          ) : (
            <Text size="sm" c="dimmed">No reminders for this indoor location.</Text>
          )}
        </Stack>

        {(updateMutation.isError || reminderQuery.isError) && (
          <Alert color="red" title="Unable to apply light schedule">
            {String(updateMutation.error ?? reminderQuery.error)}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
