import { Alert, Badge, Button, Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { listLocationReminders, upsertLocationReminder } from "./reminders";

type Props = {
  indoorEnvId: number;
  environmentId: number;
  locationId: number;
};

export function HydroponicsPanel({ indoorEnvId, environmentId, locationId }: Props) {
  const qc = useQueryClient();
  const [additiveAmount, setAdditiveAmount] = useState<number | string>(10);
  const [waterChangeLiters, setWaterChangeLiters] = useState<number | string>(20);
  const [phMin, setPhMin] = useState<number | string>(5.6);
  const [phMax, setPhMax] = useState<number | string>(6.2);
  const [ecMin, setEcMin] = useState<number | string>(1.4);
  const [ecMax, setEcMax] = useState<number | string>(2.2);
  const [intervalDays, setIntervalDays] = useState<number | string>(7);

  const statusQuery = useQuery({
    queryKey: ["reservoir-status", indoorEnvId],
    queryFn: async () => {
      const res = await commands.getReservoirStatus(indoorEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const reminderQuery = useQuery({
    queryKey: ["indoor-reminders", environmentId, locationId],
    queryFn: () => listLocationReminders(environmentId, locationId),
  });

  const logNutrientMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.logNutrientAddition(
        indoorEnvId,
        null,
        typeof additiveAmount === "number" ? additiveAmount : 0,
        "ml",
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["reservoir-status", indoorEnvId] });
      await qc.invalidateQueries({ queryKey: ["indoor-dashboard", indoorEnvId] });
    },
  });

  const logWaterChangeMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.logWaterChange(
        indoorEnvId,
        typeof waterChangeLiters === "number" ? waterChangeLiters : null,
        null,
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["reservoir-status", indoorEnvId] });
      await qc.invalidateQueries({ queryKey: ["indoor-dashboard", indoorEnvId] });
    },
  });

  const targetMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.upsertIndoorReservoirTarget(indoorEnvId, {
        ph_min: typeof phMin === "number" ? phMin : null,
        ph_max: typeof phMax === "number" ? phMax : null,
        ec_min: typeof ecMin === "number" ? ecMin : null,
        ec_max: typeof ecMax === "number" ? ecMax : null,
        ppm_min: null,
        ppm_max: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["reservoir-status", indoorEnvId] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const everyDays = typeof intervalDays === "number" ? Math.max(1, Math.floor(intervalDays)) : 7;
      const cron = `0 8 */${everyDays} * *`;
      return upsertLocationReminder({
        environmentId,
        locationId,
        scheduleType: "maintenance",
        title: "Hydro Reservoir Water Change",
        cronExpression: cron,
        notes: `Auto-created from Indoor Hydroponics panel (every ${everyDays} days).`,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["indoor-reminders", environmentId, locationId] });
    },
  });

  const status = statusQuery.data;

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Reservoir & Nutrients</Text>
          <Badge variant="light">{status?.status ?? "Unknown"}</Badge>
        </Group>

        <Text c="dimmed" size="sm">
          Last water change: {status?.last_water_change_at ? dayjs(status.last_water_change_at).format("MMM D, HH:mm") : "Never"}
        </Text>

        <Group grow>
          <NumberInput
            label="Target pH Min"
            value={phMin}
            onChange={setPhMin}
            decimalScale={2}
          />
          <NumberInput
            label="Target pH Max"
            value={phMax}
            onChange={setPhMax}
            decimalScale={2}
          />
          <NumberInput
            label="Target EC Min"
            value={ecMin}
            onChange={setEcMin}
            decimalScale={2}
          />
          <NumberInput
            label="Target EC Max"
            value={ecMax}
            onChange={setEcMax}
            decimalScale={2}
          />
        </Group>

        <Group justify="flex-end">
          <Button loading={targetMutation.isPending} onClick={() => targetMutation.mutate()}>
            Save Targets
          </Button>
        </Group>

        <Group grow>
          <NumberInput
            label="Nutrient Additive (ml)"
            value={additiveAmount}
            onChange={setAdditiveAmount}
            min={0}
          />
          <NumberInput
            label="Water Change (L)"
            value={waterChangeLiters}
            onChange={setWaterChangeLiters}
            min={0}
          />
        </Group>

        <Group justify="flex-end">
          <Button variant="light" loading={logNutrientMutation.isPending} onClick={() => logNutrientMutation.mutate()}>
            Log Nutrients
          </Button>
          <Button variant="light" loading={logWaterChangeMutation.isPending} onClick={() => logWaterChangeMutation.mutate()}>
            Log Water Change
          </Button>
        </Group>

        <Group grow>
          <NumberInput
            label="Water Change Reminder (days)"
            value={intervalDays}
            onChange={setIntervalDays}
            min={1}
            max={30}
          />
        </Group>

        <Group justify="flex-end">
          <Button loading={scheduleMutation.isPending} onClick={() => scheduleMutation.mutate()}>
            Save Water Change Reminder
          </Button>
        </Group>

        <Stack gap={4}>
          <Text size="sm" fw={500}>Existing Reminders</Text>
          {reminderQuery.data?.length ? (
            reminderQuery.data.map((s) => (
              <Group key={s.id} justify="space-between">
                <Text size="sm">{s.title}</Text>
                <Text size="xs" c="dimmed">{s.next_run_at ? dayjs(s.next_run_at).format("MMM D, HH:mm") : "No next run"}</Text>
              </Group>
            ))
          ) : (
            <Text size="sm" c="dimmed">No reminders for this indoor location.</Text>
          )}
        </Stack>

        {(statusQuery.isError || targetMutation.isError || logNutrientMutation.isError || logWaterChangeMutation.isError || scheduleMutation.isError || reminderQuery.isError) && (
          <Alert color="red" title="Indoor hydroponics action failed">
            {String(
              statusQuery.error ??
                targetMutation.error ??
                logNutrientMutation.error ??
                logWaterChangeMutation.error ??
                scheduleMutation.error ??
                reminderQuery.error,
            )}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
