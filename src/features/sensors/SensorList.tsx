import {
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Sensor } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
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
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
        <Loader />
      ) : sensors.length === 0 ? (
        <Text c="dimmed">No sensors configured.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Connection</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Interval</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sensors.map((sensor) => (
              <Table.Tr
                key={sensor.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedId(sensor.id)}
              >
                <Table.Td>
                  <Text fw={500}>{sensor.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {SENSOR_TYPE_LABELS[sensor.sensor_type] ?? sensor.sensor_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {CONNECTION_TYPE_LABELS[sensor.connection_type] ??
                      sensor.connection_type}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {sensor.is_active ? (
                    <Badge color="green" size="sm">
                      Active
                    </Badge>
                  ) : (
                    <Badge color="gray" size="sm">
                      Paused
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {sensor.poll_interval_seconds != null
                      ? `${sensor.poll_interval_seconds}s`
                      : "—"}
                  </Text>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      color={sensor.is_active ? "orange" : "green"}
                      leftSection={
                        sensor.is_active ? (
                          <IconPlayerPause size={12} />
                        ) : (
                          <IconPlayerPlay size={12} />
                        )
                      }
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
                        if (
                          confirm(
                            `Delete sensor "${sensor.name}"? This also deletes all readings.`
                          )
                        ) {
                          deleteMutation.mutate(sensor.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
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
