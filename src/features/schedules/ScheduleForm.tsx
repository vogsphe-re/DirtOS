import {
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type {
  Additive,
  NewSchedule,
  Plant,
  Schedule,
  ScheduleType,
  UpdateSchedule,
} from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "water", label: "💧 Water" },
  { value: "feed", label: "🌱 Feed / Nutrient" },
  { value: "maintenance", label: "🔧 Maintenance" },
  { value: "treatment", label: "💊 Treatment" },
  { value: "sample", label: "🔬 Sample / Test" },
  { value: "custom", label: "⚙️ Custom" },
];

const FREQUENCY_PRESETS = [
  { value: "0 8 * * *", label: "Daily (8 AM)" },
  { value: "0 8 */2 * *", label: "Every 2 days" },
  { value: "0 8 * * 1", label: "Weekly (Mondays)" },
  { value: "0 8 1,15 * *", label: "Biweekly (1st & 15th)" },
  { value: "0 8 1 * *", label: "Monthly (1st)" },
  { value: "__custom__", label: "Custom cron…" },
];

interface ScheduleFormProps {
  opened: boolean;
  onClose: () => void;
  editing?: Schedule | null;
  defaultPlantId?: number | null;
}

export function ScheduleForm({ opened, onClose, editing, defaultPlantId }: ScheduleFormProps) {
  const qc = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const [scheduleType, setScheduleType] = useState<ScheduleType>("water");
  const [title, setTitle] = useState("");
  const [frequencyPreset, setFrequencyPreset] = useState(FREQUENCY_PRESETS[0].value);
  const [customCron, setCustomCron] = useState("");
  const [plantId, setPlantId] = useState<string | null>(null);
  const [additiveId, setAdditiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isCustomCron = frequencyPreset === "__custom__";
  const cronExpression = isCustomCron ? customCron || null : frequencyPreset || null;

  // Populate when editing
  useEffect(() => {
    if (editing) {
      setScheduleType(editing.schedule_type);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setIsActive(editing.is_active);
      setPlantId(editing.plant_id ? String(editing.plant_id) : null);
      setAdditiveId(editing.additive_id ? String(editing.additive_id) : null);
      const preset = FREQUENCY_PRESETS.find((p) => p.value === editing.cron_expression);
      if (preset) {
        setFrequencyPreset(preset.value);
      } else {
        setFrequencyPreset("__custom__");
        setCustomCron(editing.cron_expression ?? "");
      }
    } else {
      setScheduleType("water");
      setTitle("");
      setFrequencyPreset(FREQUENCY_PRESETS[0].value);
      setCustomCron("");
      setPlantId(defaultPlantId ? String(defaultPlantId) : null);
      setAdditiveId(null);
      setNotes("");
      setIsActive(true);
    }
  }, [editing, opened, defaultPlantId]);

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: opened,
  });

  const { data: additives = [] } = useQuery<Additive[]>({
    queryKey: ["additives"],
    queryFn: async () => {
      const res = await commands.listAdditives();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: opened && scheduleType === "feed",
  });

  const plantOptions = [
    { value: "", label: "No specific plant" },
    ...plants
      .filter((p) => !activeEnvId || p.environment_id === activeEnvId)
      .map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const additiveOptions = [
    { value: "", label: "No additive" },
    ...additives.map((a) => ({ value: String(a.id), label: a.name })),
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const input: UpdateSchedule = {
          schedule_type: scheduleType,
          title: title.trim() || null,
          cron_expression: cronExpression,
          is_active: isActive,
          plant_id: plantId ? parseInt(plantId) : null,
          location_id: null,
          additive_id: additiveId ? parseInt(additiveId) : null,
          notes: notes.trim() || null,
        };
        const res = await commands.updateSchedule(editing.id, input);
        if (res.status === "error") throw new Error(res.error);
      } else {
        const input: NewSchedule = {
          environment_id: activeEnvId,
          plant_id: plantId ? parseInt(plantId) : null,
          location_id: null,
          schedule_type: scheduleType,
          title: title.trim(),
          cron_expression: cronExpression,
          next_run_at: null,
          is_active: isActive,
          additive_id: additiveId ? parseInt(additiveId) : null,
          notes: notes.trim() || null,
        };
        const res = await commands.createSchedule(input);
        if (res.status === "error") throw new Error(res.error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      notifications.show({ message: editing ? "Schedule updated." : "Schedule created.", color: "green" });
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={5}>{editing ? "Edit Schedule" : "New Schedule"}</Title>}
      size="md"
    >
      <Stack>
        <Select
          label="Type"
          data={SCHEDULE_TYPES}
          value={scheduleType}
          onChange={(v) => v && setScheduleType(v as ScheduleType)}
          required
        />

        <TextInput
          label="Title"
          placeholder="Water tomatoes"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />

        <Select
          label="Frequency"
          data={FREQUENCY_PRESETS}
          value={frequencyPreset}
          onChange={(v) => v && setFrequencyPreset(v)}
        />

        {isCustomCron && (
          <TextInput
            label="Custom cron expression"
            description="5-field: minute hour day-of-month month weekday  (e.g. 0 8 * * *)"
            placeholder="0 8 * * *"
            value={customCron}
            onChange={(e) => setCustomCron(e.currentTarget.value)}
            required
          />
        )}

        <Select
          label="Plant (optional)"
          data={plantOptions}
          value={plantId ?? ""}
          onChange={(v) => setPlantId(v || null)}
          clearable
          searchable
        />

        {scheduleType === "feed" && (
          <Select
            label="Additive / Nutrient (optional)"
            data={additiveOptions}
            value={additiveId ?? ""}
            onChange={(v) => setAdditiveId(v || null)}
            clearable
            searchable
          />
        )}

        <Textarea
          label="Notes"
          placeholder="Any notes about this schedule…"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
        />

        <Checkbox
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!title.trim() || (!cronExpression)}
          >
            {editing ? "Save changes" : "Create schedule"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
