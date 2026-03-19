import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import {
  IconEdit,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { commands } from "../../lib/bindings";
import type { Sensor, SensorLimit, SensorReading } from "../../lib/bindings";
import { SensorForm } from "./SensorForm";

type TimeRange = "24h" | "7d" | "30d";

const RANGE_LIMITS: Record<TimeRange, number> = {
  "24h": 288,   // ~5 min intervals
  "7d": 1008,
  "30d": 4320,
};

interface Props {
  sensorId: number;
  onClose: () => void;
}

export function SensorDetail({ sensorId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<TimeRange>("24h");
  const [editOpen, setEditOpen] = useState(false);

  const { data: sensor, isLoading } = useQuery<Sensor | null>({
    queryKey: ["sensor", sensorId],
    queryFn: async () => {
      const res = await commands.getSensor(sensorId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: limits } = useQuery<SensorLimit | null>({
    queryKey: ["sensor-limits", sensorId],
    queryFn: async () => {
      const res = await commands.getSensorLimits(sensorId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: readings = [], isFetching } = useQuery<SensorReading[]>({
    queryKey: ["sensor-readings", sensorId, range],
    queryFn: async () => {
      const res = await commands.listSensorReadings(sensorId, RANGE_LIMITS[range], 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data.reverse();
    },
    refetchInterval: 60000,
  });

  // Live update from events
  useEffect(() => {
    const unlisten = listen<{ sensor_id: number }>("sensor:reading", (event) => {
      if (event.payload.sensor_id === sensorId) {
        queryClient.invalidateQueries({ queryKey: ["sensor-readings", sensorId, range] });
        queryClient.invalidateQueries({ queryKey: ["sensor-latest", sensorId] });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [sensorId, range, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.deleteSensor(sensorId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
      onClose();
    },
  });

  const unit = limits?.unit ?? "";

  const chartData = readings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: r.value,
  }));

  if (isLoading || !sensor) {
    return (
      <Drawer opened onClose={onClose} title="Sensor Detail" position="right" size="xl">
        <Loader />
      </Drawer>
    );
  }

  return (
    <>
      <Drawer
        opened
        onClose={onClose}
        title={
          <Group gap="xs">
            <Text fw={600}>{sensor.name}</Text>
            <Badge size="sm" variant="light">
              {sensor.sensor_type}
            </Badge>
            {sensor.is_active ? (
              <Badge size="sm" color="green">
                Active
              </Badge>
            ) : (
              <Badge size="sm" color="gray">
                Paused
              </Badge>
            )}
          </Group>
        }
        position="right"
        size="xl"
      >
        <Stack>
          <Group justify="space-between">
            <SegmentedControl
              value={range}
              onChange={(v) => setRange(v as TimeRange)}
              data={[
                { label: "24 h", value: "24h" },
                { label: "7 d", value: "7d" },
                { label: "30 d", value: "30d" },
              ]}
            />
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                loading={isFetching}
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["sensor-readings", sensorId, range],
                  })
                }
              >
                Refresh
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconEdit size={14} />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => {
                  if (confirm("Delete this sensor and all its readings?")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Delete
              </Button>
            </Group>
          </Group>

          {readings.length === 0 ? (
            <Text c="dimmed" ta="center" mt="xl">
              No readings recorded in this time range.
            </Text>
          ) : (
            <Box h={280}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    unit={unit ? ` ${unit}` : ""}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [
                      `${Number(v).toFixed(2)}${unit ? ` ${unit}` : ""}`,
                      sensor.name,
                    ]}
                  />
                  {limits?.min_value !== null && limits?.min_value !== undefined && (
                    <ReferenceLine
                      y={limits.min_value}
                      stroke="orange"
                      strokeDasharray="5 5"
                      label={{ value: `Min ${limits.min_value}`, fontSize: 10 }}
                    />
                  )}
                  {limits?.max_value !== null && limits?.max_value !== undefined && (
                    <ReferenceLine
                      y={limits.max_value}
                      stroke="red"
                      strokeDasharray="5 5"
                      label={{ value: `Max ${limits.max_value}`, fontSize: 10 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--mantine-color-blue-6)"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}

          <Divider label="Recent Readings" labelPosition="left" />

          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Value</Table.Th>
                  <Table.Th>Unit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {readings
                  .slice()
                  .reverse()
                  .slice(0, 100)
                  .map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text size="xs">
                          {new Date(r.recorded_at).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {r.value.toFixed(3)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {r.unit ?? unit}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Drawer>

      {editOpen && (
        <SensorForm
          opened={editOpen}
          environmentId={sensor.environment_id ?? 0}
          sensor={sensor}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["sensor", sensorId] });
            queryClient.invalidateQueries({ queryKey: ["sensors"] });
            setEditOpen(false);
          }}
        />
      )}
    </>
  );
}
