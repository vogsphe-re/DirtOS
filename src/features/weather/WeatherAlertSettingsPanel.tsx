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
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  metersPerSecondToMph,
  useUnits,
} from "../../lib/units";
import { useAppStore } from "../../stores/appStore";

const DEFAULTS: WeatherAlertSettings = {
  heat_max_c: 38,
  frost_min_c: 0,
  wind_max_ms: 15,
  precip_prob_threshold: 0,
  alerts_enabled: true,
};

// Convert stored °C threshold to display unit
function toDisplay(c: number, imperial: boolean) {
  return imperial ? Math.round(celsiusToFahrenheit(c) * 10) / 10 : c;
}

// Convert display-unit threshold back to °C for storage
function toCelsius(val: number | string, fallback: number, imperial: boolean): number {
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return fallback;
  return imperial ? fahrenheitToCelsius(n) : n;
}

// Convert stored m/s threshold to display unit
function toWindDisplay(ms: number, imperial: boolean) {
  return imperial ? Math.round(metersPerSecondToMph(ms) * 10) / 10 : ms;
}

// Convert display-unit wind back to m/s for storage
function toWindMs(val: number | string, fallback: number, imperial: boolean): number {
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return fallback;
  return imperial ? n / 2.23694 : n;
}

// Inner form — re-mounts (via key) whenever saved data or unit system changes
function AlertForm({
  initial,
  imperial,
}: {
  initial: WeatherAlertSettings;
  imperial: boolean;
}) {
  const qc = useQueryClient();
  const fmt = useUnits();
  const [enabled, setEnabled] = useState(initial.alerts_enabled);
  const [heatMax, setHeatMax] = useState<number | string>(
    toDisplay(initial.heat_max_c, imperial)
  );
  const [frostMin, setFrostMin] = useState<number | string>(
    toDisplay(initial.frost_min_c, imperial)
  );
  const [windMax, setWindMax] = useState<number | string>(
    toWindDisplay(initial.wind_max_ms, imperial)
  );
  const [precipProb, setPrecipProb] = useState<number | string>(
    Math.round(initial.precip_prob_threshold * 100)
  );

  const mut = useMutation({
    mutationFn: async () => {
      const settings: WeatherAlertSettings = {
        alerts_enabled: enabled,
        // Always store in °C
        heat_max_c: toCelsius(heatMax, 38, imperial),
        frost_min_c: toCelsius(frostMin, 0, imperial),
        // Wind — stored as m/s
        wind_max_ms: toWindMs(windMax, 15, imperial),
        // Precip probability stored as 0–1 fraction
        precip_prob_threshold: (() => {
          const n = typeof precipProb === "number" ? precipProb : parseFloat(String(precipProb));
          return isNaN(n) ? 0 : n / 100;
        })(),
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

  const tempUnit = fmt.tempUnit;
  const windUnit = fmt.windUnit;

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
          label={`Max temperature (${tempUnit})`}
          description="Alert when forecast high exceeds"
          value={heatMax}
          onChange={setHeatMax}
          min={imperial ? 32 : 0}
          max={imperial ? 140 : 60}
          step={imperial ? 1 : 1}
          disabled={!enabled}
        />
        <NumberInput
          label={`Min temperature (${tempUnit})`}
          description="Alert when forecast low falls to or below"
          value={frostMin}
          onChange={setFrostMin}
          min={imperial ? -22 : -30}
          max={imperial ? 68 : 20}
          step={1}
          disabled={!enabled}
        />
      </Group>
      <Group grow>
        <NumberInput
          label={`Max wind speed (${windUnit})`}
          description="Alert when winds exceed (0 = disabled)"
          value={windMax}
          onChange={setWindMax}
          min={0}
          max={imperial ? 224 : 100}
          step={imperial ? 5 : 1}
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
  const imperial = useAppStore((s) => s.unitSystem === "imperial");
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
        // Re-mount AlertForm when data loads OR unit system changes
        <AlertForm
          key={`${saved ? "loaded" : "default"}-${imperial ? "imp" : "met"}`}
          initial={saved ?? DEFAULTS}
          imperial={imperial}
        />
      )}
    </Card>
  );
}
