import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { commands } from "../../lib/bindings";
import type { Sensor } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { EmptyState, PageLoader } from "../../components/LoadingStates";
import { SensorForm } from "./SensorForm";
import { SensorDetail } from "./SensorDetail";

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

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  serial: "Serial",
  usb: "USB",
  mqtt: "MQTT",
  http: "HTTP",
  manual: "Manual",
};

export function SensorList() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: sensors = [], isLoading } = useQuery<Sensor[]>({
    queryKey: ["sensors", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listSensors(activeEnvId, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = active
        ? await commands.startSensor(id)
        : await commands.stopSensor(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["sensors", activeEnvId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteSensor(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["sensors", activeEnvId] }),
  });

  const rowVirtualizer = useVirtualizer({
    count: sensors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  if (!activeEnvId) {
    return (
      <Stack p="md" align="center" mt="xl">
        <Text c="dimmed">Select an environment to view sensors.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md">
      <Group justify="space-between">
        <Title order={3}>All Sensors</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setAddOpen(true)}
        >
          Add Sensor
        </Button>
      </Group>

      {isLoading ? (
        <PageLoader label="Loading sensors…" />
      ) : sensors.length === 0 ? (
        <EmptyState
          title="No sensors configured"
          message="Add a sensor to start collecting environmental readings and alerts."
          actionLabel="Add sensor"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <Box
          ref={parentRef}
          className="dirtos-scroll-panel"
          style={{ position: "relative", border: "1px solid var(--mantine-color-default-border)", borderRadius: 12 }}
        >
          <Box h={rowVirtualizer.getTotalSize()} pos="relative">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const sensor = sensors[virtualRow.index];
              return (
                <Box
                  key={sensor.id}
                  pos="absolute"
                  top={0}
                  left={0}
                  right={0}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  p="sm"
                >
                  <Box
                    className="dirtos-glass"
                    p="md"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(sensor.id)}
                  >
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Stack gap={6}>
                        <Group gap="xs">
                          <Text fw={600}>{sensor.name}</Text>
                          <Badge size="sm" variant="light">
                            {SENSOR_TYPE_LABELS[sensor.sensor_type] ?? sensor.sensor_type}
                          </Badge>
                          <Badge color={sensor.is_active ? "green" : "gray"} size="sm">
                            {sensor.is_active ? "Active" : "Paused"}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {CONNECTION_TYPE_LABELS[sensor.connection_type] ?? sensor.connection_type}
                          {sensor.poll_interval_seconds != null ? ` · ${sensor.poll_interval_seconds}s poll interval` : ""}
                        </Text>
                      </Stack>
                      <Group gap="xs" onClick={(event) => event.stopPropagation()}>
                        <Button
                          size="xs"
                          variant="light"
                          color={sensor.is_active ? "orange" : "green"}
                          leftSection={sensor.is_active ? <IconPlayerPause size={12} /> : <IconPlayerPlay size={12} />}
                          onClick={() =>
                            toggleMutation.mutate({
                              id: sensor.id,
                              active: !sensor.is_active,
                            })
                          }
                        >
                          {sensor.is_active ? "Pause" : "Start"}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => {
                            if (confirm(`Delete sensor "${sensor.name}"? This also deletes all readings.`)) {
                              deleteMutation.mutate(sensor.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

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
    </Stack>
  );
}
