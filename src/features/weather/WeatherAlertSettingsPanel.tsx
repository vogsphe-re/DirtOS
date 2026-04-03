import {
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { WeatherAlertSettings } from "../../lib/bindings";
import { commands } from "../../lib/bindings";

const DEFAULTS: WeatherAlertSettings = {
  heat_max_c: 38,
  frost_min_c: 0,
  wind_max_ms: 15,
  precip_prob_threshold: 0,
  alerts_enabled: true,
};

// Inner form receives saved settings as initial values
function AlertForm({ initial }: { initial: WeatherAlertSettings }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(initial.alerts_enabled);
  const [heatMax, setHeatMax] = useState<number | string>(initial.heat_max_c);
  const [frostMin, setFrostMin] = useState<number | string>(initial.frost_min_c);
  const [windMax, setWindMax] = useState<number | string>(initial.wind_max_ms);
  const [precipProb, setPrecipProb] = useState<number | string>(
    Math.round(initial.precip_prob_threshold * 100)
  );

  const mut = useMutation({
    mutationFn: async () => {
      const toNum = (v: number | string, fallback: number) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return isNaN(n) ? fallback : n;
      };
      const settings: WeatherAlertSettings = {
        alerts_enabled: enabled,
        heat_max_c: toNum(heatMax, 38),
        frost_min_c: toNum(frostMin, 0),
        wind_max_ms: toNum(windMax, 15),
        precip_prob_threshold: toNum(precipProb, 0) / 100,
      };
      const r = await commands.setWeatherAlertSettings(settings);
      if (r.status === "error") throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weather-alert-settings"] });
      notifications.show({ message: "Alert settings saved", color: "green" });
    },
    onError: (e: Error) => {
      notifications.show({ message: e.message, color: "red", title: "Error" });
    },
  });

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={5}>Weather Alert Thresholds</Title>
        <Switch
          label="Alerts enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
      </Group>
      <Text size="xs" c="dimmed">
        When a refresh detects a threshold breach, DirtOS creates an Issue automatically.
        Set a value to 0 to disable that specific alert.
      </Text>
      <Divider />

      <Group grow>
        <NumberInput
          label="Max temperature (°C)"
          description="Alert when forecast high exceeds"
          value={heatMax}
          onChange={setHeatMax}
          min={0}
          max={60}
          step={1}
          disabled={!enabled}
        />
        <NumberInput
          label="Min temperature (°C)"
          description="Alert when forecast low falls to or below"
          value={frostMin}
          onChange={setFrostMin}
          min={-30}
          max={20}
          step={1}
          disabled={!enabled}
        />
      </Group>
      <Group grow>
        <NumberInput
          label="Max wind speed (m/s)"
          description="Alert when winds exceed (0 = disabled)"
          value={windMax}
          onChange={setWindMax}
          min={0}
          max={100}
          step={1}
          disabled={!enabled}
        />
        <NumberInput
          label="Precipitation probability (%)"
          description="Alert when chance of rain exceeds (0 = disabled)"
          value={precipProb}
          onChange={setPrecipProb}
          min={0}
          max={100}
          step={5}
          disabled={!enabled}
        />
      </Group>

      <Group justify="flex-end">
        <Button size="sm" loading={mut.isPending} onClick={() => mut.mutate()}>
          Save thresholds
        </Button>
      </Group>
    </Stack>
  );
}

export function WeatherAlertSettingsPanel() {
  const { data: saved, isLoading } = useQuery<WeatherAlertSettings>({
    queryKey: ["weather-alert-settings"],
    queryFn: async () => {
      const r = await commands.getWeatherAlertSettings();
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
  });

  return (
    <Card withBorder p="md" radius="md">
      {isLoading ? (
        <Text c="dimmed" size="sm">Loading settings…</Text>
      ) : (
        // Re-mount AlertForm with a key so initial state resets when data loads
        <AlertForm key={saved ? "loaded" : "default"} initial={saved ?? DEFAULTS} />
      )}
    </Card>
  );
}
