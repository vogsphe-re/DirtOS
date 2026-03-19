import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { JournalEntry, Location, Plant } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";

// ---------------------------------------------------------------------------
// Conditions JSON shape (stored as string in DB)
// ---------------------------------------------------------------------------
interface JournalConditions {
  weather?: "sunny" | "cloudy" | "rainy" | "windy" | "snowy" | "foggy" | "overcast";
  temperature_c?: number;
  humidity_pct?: number;
  soil_moisture?: number;
  plant_health?: "healthy" | "fair" | "poor" | "critical";
}

function parseConditions(json: string | null): JournalConditions {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const WEATHER_OPTIONS = [
  { value: "sunny", label: "☀️ Sunny" },
  { value: "cloudy", label: "☁️ Cloudy" },
  { value: "overcast", label: "🌥️ Overcast" },
  { value: "rainy", label: "🌧️ Rainy" },
  { value: "windy", label: "💨 Windy" },
  { value: "snowy", label: "❄️ Snowy" },
  { value: "foggy", label: "🌫️ Foggy" },
];

const HEALTH_OPTIONS = [
  { value: "healthy", label: "✅ Healthy" },
  { value: "fair", label: "🟡 Fair" },
  { value: "poor", label: "🟠 Poor" },
  { value: "critical", label: "🔴 Critical" },
];

interface JournalFormProps {
  opened: boolean;
  onClose: () => void;
  existing?: JournalEntry;
  defaultPlantId?: number;
  defaultLocationId?: number;
}

export function JournalForm({
  opened,
  onClose,
  existing,
  defaultPlantId,
  defaultLocationId,
}: JournalFormProps) {
  const queryClient = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const existingConditions = parseConditions(existing?.conditions_json ?? null);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [plantId, setPlantId] = useState<string | null>(
    existing?.plant_id
      ? String(existing.plant_id)
      : defaultPlantId
      ? String(defaultPlantId)
      : null
  );
  const [locationId, setLocationId] = useState<string | null>(
    existing?.location_id
      ? String(existing.location_id)
      : defaultLocationId
      ? String(defaultLocationId)
      : null
  );
  const [weather, setWeather] = useState<string | null>(existingConditions.weather ?? null);
  const [temperatureC, setTemperatureC] = useState<number | string>(
    existingConditions.temperature_c ?? ""
  );
  const [humidityPct, setHumidityPct] = useState<number | string>(
    existingConditions.humidity_pct ?? ""
  );
  const [soilMoisture, setSoilMoisture] = useState<number | string>(
    existingConditions.soil_moisture ?? ""
  );
  const [plantHealth, setPlantHealth] = useState<string | null>(
    existingConditions.plant_health ?? null
  );
  const [titleError, setTitleError] = useState("");

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listLocations(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const buildConditionsJson = (): string | null => {
    const c: JournalConditions = {};
    if (weather) c.weather = weather as JournalConditions["weather"];
    if (temperatureC !== "" && temperatureC != null)
      c.temperature_c = Number(temperatureC);
    if (humidityPct !== "" && humidityPct != null) c.humidity_pct = Number(humidityPct);
    if (soilMoisture !== "" && soilMoisture != null)
      c.soil_moisture = Number(soilMoisture);
    if (plantHealth) c.plant_health = plantHealth as JournalConditions["plant_health"];
    return Object.keys(c).length > 0 ? JSON.stringify(c) : null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 3) {
        setTitleError("Title must be at least 3 characters.");
        throw new Error("Validation failed");
      }
      setTitleError("");
      const conditionsJson = buildConditionsJson();

      if (existing) {
        const res = await commands.updateJournalEntry(existing.id, {
          title: title || null,
          body: body || null,
          conditions_json: conditionsJson,
        });
        if (res.status === "error") throw new Error(res.error);
        return res.data;
      } else {
        const res = await commands.createJournalEntry({
          environment_id: activeEnvId,
          plant_id: plantId ? Number(plantId) : null,
          location_id: locationId ? Number(locationId) : null,
          title: title.trim(),
          body: body || null,
          conditions_json: conditionsJson,
        });
        if (res.status === "error") throw new Error(res.error);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({
        message: existing ? "Entry updated." : "Entry created.",
        color: "green",
      });
      onClose();
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        notifications.show({ title: "Error", message: err.message, color: "red" });
      }
    },
  });

  const plantOptions = plants.map((p) => ({ value: String(p.id), label: p.name }));
  const locationOptions = locations.map((l) => ({ value: String(l.id), label: l.name }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={existing ? "Edit Journal Entry" : "New Journal Entry"}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          label="Title"
          placeholder="What did you observe?"
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          error={titleError}
        />
        <Textarea
          label="Notes"
          placeholder="Describe what you saw, did, or noticed…"
          autosize
          minRows={4}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
        />

        {/* Links */}
        <Group grow>
          <Select
            label="Plant"
            placeholder="None"
            data={plantOptions}
            value={plantId}
            onChange={setPlantId}
            searchable
            clearable
          />
          <Select
            label="Location"
            placeholder="None"
            data={locationOptions}
            value={locationId}
            onChange={setLocationId}
            clearable
          />
        </Group>

        {/* Conditions */}
        <Title order={6} mt="xs">
          Conditions (optional)
        </Title>
        <Group grow>
          <Select
            label="Weather"
            placeholder="—"
            data={WEATHER_OPTIONS}
            value={weather}
            onChange={setWeather}
            clearable
          />
          <Select
            label="Plant health"
            placeholder="—"
            data={HEALTH_OPTIONS}
            value={plantHealth}
            onChange={setPlantHealth}
            clearable
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Temperature (°C)"
            placeholder="e.g. 22"
            value={temperatureC}
            onChange={setTemperatureC}
            decimalScale={1}
          />
          <NumberInput
            label="Humidity (%)"
            placeholder="e.g. 65"
            value={humidityPct}
            onChange={setHumidityPct}
            min={0}
            max={100}
          />
          <NumberInput
            label="Soil moisture (%)"
            placeholder="e.g. 40"
            value={soilMoisture}
            onChange={setSoilMoisture}
            min={0}
            max={100}
          />
        </Group>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {existing ? "Save Changes" : "Create Entry"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
