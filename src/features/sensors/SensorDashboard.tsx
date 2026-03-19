import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDot,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { commands } from "../../lib/bindings";
import type { Sensor, SensorLimit, SensorReading } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { SensorForm } from "./SensorForm";
import { SensorDetail } from "./SensorDetail";
import { SensorList } from "./SensorList";
import { SoilTests } from "./SoilTests";

const SENSOR_TYPE_LABELS: Record<string, string> = {
  moisture: "Moisture",
  light: "Light",
  temperature: "Temperature",
  humidity: "Humidity",
  ph: "pH",
  ec: "EC",
  co2: "CO₂",
  air_quality: "Air Quality",
  custom: "Custom",
};

interface LiveReading {
  sensorId: number;
  value: number;
  unit: string | null;
  timestamp: string;
}

interface SensorCardProps {
  sensor: Sensor;
  liveValue?: number | null;
  onSelect: (id: number) => void;
  onToggle: (id: number, active: boolean) => void;
}

function SensorCard({ sensor, liveValue, onSelect, onToggle }: SensorCardProps) {
  const { data: latest } = useQuery<SensorReading | null>({
    queryKey: ["sensor-latest", sensor.id],
    queryFn: async () => {
      const res = await commands.getLatestReading(sensor.id);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: limits } = useQuery<SensorLimit | null>({
    queryKey: ["sensor-limits", sensor.id],
    queryFn: async () => {
      const res = await commands.getSensorLimits(sensor.id);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: sparkData = [] } = useQuery<SensorReading[]>({
    queryKey: ["sensor-spark", sensor.id],
    queryFn: async () => {
      const res = await commands.listSensorReadings(sensor.id, 48, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data.reverse();
    },
    refetchInterval: 60000,
  });

  const currentValue = liveValue ?? latest?.value ?? null;
  const unit = latest?.unit ?? limits?.unit ?? "";

  const getStatus = (): "ok" | "warn" | "error" => {
    if (currentValue === null || !limits) return "ok";
    const tooLow = limits.min_value !== null && currentValue < limits.min_value;
    const tooHigh = limits.max_value !== null && currentValue > limits.max_value;
    if (tooLow || tooHigh) return "error";
    // warn if within 10% of limit
    const nearMin =
      limits.min_value !== null &&
      currentValue < limits.min_value + Math.abs(limits.min_value) * 0.1;
    const nearMax =
      limits.max_value !== null &&
      currentValue > limits.max_value - Math.abs(limits.max_value) * 0.1;
    if (nearMin || nearMax) return "warn";
    return "ok";
  };

  const status = getStatus();
  const statusColors = { ok: "green", warn: "yellow", error: "red" };
  const StatusIcon =
    status === "error"
      ? IconAlertTriangle
      : status === "warn"
      ? IconCircleDot
      : IconCircleCheck;

  return (
    <Card
      withBorder
      padding="md"
      style={{ cursor: "pointer", opacity: sensor.is_active ? 1 : 0.6 }}
      onClick={() => onSelect(sensor.id)}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <StatusIcon size={16} color={`var(--mantine-color-${statusColors[status]}-6)`} />
          <Text fw={600} size="sm">
            {sensor.name}
          </Text>
        </Group>
        <Group gap={4} onClick={(e) => e.stopPropagation()}>
          <Badge size="xs" variant="light">
            {SENSOR_TYPE_LABELS[sensor.sensor_type] ?? sensor.sensor_type}
          </Badge>
          <Tooltip label={sensor.is_active ? "Pause sensor" : "Start sensor"}>
            <ActionIcon
              size="xs"
              variant="subtle"
              color={sensor.is_active ? "red" : "green"}
              onClick={() => onToggle(sensor.id, !sensor.is_active)}
            >
              {sensor.is_active ? <IconPlayerPause size={12} /> : <IconPlayerPlay size={12} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {currentValue !== null ? (
        <Text size="2rem" fw={700} c={statusColors[status]}>
          {currentValue.toFixed(2)}
          <Text component="span" size="sm" fw={400} ml={4} c="dimmed">
            {unit}
          </Text>
        </Text>
      ) : (
        <Text c="dimmed" size="sm">
          No readings yet
        </Text>
      )}

      {sparkData.length > 2 && (
        <Box h={50} mt="xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={`var(--mantine-color-${statusColors[status]}-6)`}
                dot={false}
                strokeWidth={1.5}
              />
              <ChartTooltip
                formatter={(v: unknown) => [`${Number(v).toFixed(2)} ${unit}`, ""]}
                contentStyle={{ fontSize: 11 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Card>
  );
}

export function SensorDashboard() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [liveValues, setLiveValues] = useState<Record<number, number>>({});

  const { data: sensors = [], isLoading } = useQuery<Sensor[]>({
    queryKey: ["sensors", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listSensors(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  // Listen for real-time sensor readings
  useEffect(() => {
    const unlisten = listen<LiveReading>("sensor:reading", (event) => {
      const { sensorId, value } = event.payload;
      setLiveValues((prev) => ({ ...prev, [sensorId]: value }));
      // Invalidate queries to refresh latest reading cards
      queryClient.invalidateQueries({ queryKey: ["sensor-latest", sensorId] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  // Listen for limit breach notifications
  useEffect(() => {
    const unlisten = listen("sensor:limit_breach", () => {
      queryClient.invalidateQueries({ queryKey: ["sensors", activeEnvId] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient, activeEnvId]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = active
        ? await commands.startSensor(id)
        : await commands.stopSensor(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sensors", activeEnvId] }),
  });

  if (!activeEnvId) {
    return (
      <Stack p="md" align="center" mt="xl">
        <Text c="dimmed">Select an environment to view sensors.</Text>
      </Stack>
    );
  }

  return (
    <Tabs defaultValue="dashboard" p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Sensors</Title>
        <Group>
          <Tabs.List>
            <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
            <Tabs.Tab value="list">Sensor List</Tabs.Tab>
            <Tabs.Tab value="soil">Soil Tests</Tabs.Tab>
          </Tabs.List>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            Add Sensor
          </Button>
        </Group>
      </Group>

      <Tabs.Panel value="dashboard">
        {isLoading ? (
          <Loader />
        ) : sensors.length === 0 ? (
          <Text c="dimmed">No sensors configured. Add a sensor to get started.</Text>
        ) : (
          <Grid>
            {sensors.map((sensor) => (
              <Grid.Col key={sensor.id} span={{ base: 12, sm: 6, lg: 4 }}>
                <SensorCard
                  sensor={sensor}
                  liveValue={liveValues[sensor.id] ?? null}
                  onSelect={setSelectedId}
                  onToggle={(id, active) => toggleMutation.mutate({ id, active })}
                />
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="list">
        <SensorList />
      </Tabs.Panel>

      <Tabs.Panel value="soil">
        <SoilTests />
      </Tabs.Panel>

      <SensorForm
        opened={addOpen}
        environmentId={activeEnvId}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["sensors", activeEnvId] });
          setAddOpen(false);
        }}
      />

      {selectedId !== null && (
        <SensorDetail
          sensorId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Tabs>
  );
}
