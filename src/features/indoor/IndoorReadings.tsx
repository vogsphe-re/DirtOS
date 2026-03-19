import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { commands, type IndoorReading } from "../../lib/bindings";

type Props = {
  indoorEnvId: number;
};

export function IndoorReadings({ indoorEnvId }: Props) {
  const qc = useQueryClient();
  const [windowDays, setWindowDays] = useState<"7" | "30">("7");
  const [airTemp, setAirTemp] = useState<number | string>(24);
  const [airHumidity, setAirHumidity] = useState<number | string>(58);
  const [waterTemp, setWaterTemp] = useState<number | string>(20);
  const [waterPh, setWaterPh] = useState<number | string>(5.9);
  const [waterEc, setWaterEc] = useState<number | string>(1.7);
  const [waterPpm, setWaterPpm] = useState<number | string>(850);
  const [co2, setCo2] = useState<number | string>(900);

  const startDate = dayjs().subtract(Number(windowDays), "day").format("YYYY-MM-DD");

  const readingsQuery = useQuery<IndoorReading[]>({
    queryKey: ["indoor-readings", indoorEnvId, windowDays],
    queryFn: async () => {
      const res = await commands.listIndoorReadings(indoorEnvId, startDate, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.logIndoorReading({
        indoor_environment_id: indoorEnvId,
        water_temp: typeof waterTemp === "number" ? waterTemp : null,
        water_ph: typeof waterPh === "number" ? waterPh : null,
        water_ec: typeof waterEc === "number" ? waterEc : null,
        water_ppm: typeof waterPpm === "number" ? waterPpm : null,
        air_temp: typeof airTemp === "number" ? airTemp : null,
        air_humidity: typeof airHumidity === "number" ? airHumidity : null,
        co2_ppm: typeof co2 === "number" ? co2 : null,
        vpd: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["indoor-readings", indoorEnvId] });
      await qc.invalidateQueries({ queryKey: ["indoor-dashboard", indoorEnvId] });
    },
  });

  const latest = readingsQuery.data?.[readingsQuery.data.length - 1] ?? null;

  const vpdZone = (() => {
    const vpd = latest?.vpd;
    if (vpd === null || vpd === undefined) return { label: "Unknown", color: "gray" };
    if (vpd < 0.4) return { label: "Danger (Humid)", color: "red" };
    if (vpd <= 0.8) return { label: "Propagation", color: "teal" };
    if (vpd <= 1.2) return { label: "Vegetative", color: "green" };
    if (vpd <= 1.6) return { label: "Flowering", color: "blue" };
    return { label: "Danger (Dry)", color: "red" };
  })();

  const chartData = (readingsQuery.data ?? []).map((r) => ({
    t: dayjs(r.recorded_at).format("MM/DD HH:mm"),
    vpd: r.vpd,
    airTemp: r.air_temp,
    waterPh: r.water_ph,
    waterEc: r.water_ec,
  }));

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Indoor Readings</Text>
          <SegmentedControl
            value={windowDays}
            onChange={(v) => setWindowDays(v as "7" | "30")}
            data={[
              { label: "7d", value: "7" },
              { label: "30d", value: "30" },
            ]}
          />
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Current VPD: {latest?.vpd !== null && latest?.vpd !== undefined ? `${latest.vpd.toFixed(2)} kPa` : "-"}
          </Text>
          <Badge color={vpdZone.color} variant="light">
            {vpdZone.label}
          </Badge>
        </Group>

        <Group grow>
          <NumberInput label="Air Temp (C)" value={airTemp} onChange={setAirTemp} decimalScale={1} />
          <NumberInput label="Air RH (%)" value={airHumidity} onChange={setAirHumidity} decimalScale={1} />
          <NumberInput label="CO2 (ppm)" value={co2} onChange={setCo2} decimalScale={0} />
        </Group>

        <Group grow>
          <NumberInput label="Water Temp (C)" value={waterTemp} onChange={setWaterTemp} decimalScale={1} />
          <NumberInput label="pH" value={waterPh} onChange={setWaterPh} decimalScale={2} />
          <NumberInput label="EC" value={waterEc} onChange={setWaterEc} decimalScale={2} />
          <NumberInput label="PPM" value={waterPpm} onChange={setWaterPpm} decimalScale={0} />
        </Group>

        {logMutation.isError && (
          <Alert color="red" title="Unable to log reading">
            {String(logMutation.error)}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button onClick={() => logMutation.mutate()} loading={logMutation.isPending}>
            Log Reading
          </Button>
        </Group>

        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey="t" minTickGap={24} />
              <YAxis yAxisId="vpd" domain={[0, 2.4]} width={36} />
              <YAxis yAxisId="temp" orientation="right" width={36} hide />
              <RechartsTooltip />
              <Line yAxisId="vpd" type="monotone" dataKey="vpd" stroke="#2a9d8f" strokeWidth={2} dot={false} name="VPD (kPa)" />
              <Line yAxisId="temp" type="monotone" dataKey="airTemp" stroke="#e76f51" strokeWidth={1.8} dot={false} name="Air Temp (C)" />
              <Line yAxisId="temp" type="monotone" dataKey="waterPh" stroke="#3a86ff" strokeWidth={1.6} dot={false} name="Water pH" />
              <Line yAxisId="temp" type="monotone" dataKey="waterEc" stroke="#8338ec" strokeWidth={1.6} dot={false} name="Water EC" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Air</Table.Th>
              <Table.Th>Water</Table.Th>
              <Table.Th>VPD</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(readingsQuery.data ?? []).slice(0, 12).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{dayjs(r.recorded_at).format("MMM D, HH:mm")}</Table.Td>
                <Table.Td>
                  {r.air_temp ?? "-"}C / {r.air_humidity ?? "-"}% / {r.co2_ppm ?? "-"}ppm
                </Table.Td>
                <Table.Td>
                  {r.water_temp ?? "-"}C / pH {r.water_ph ?? "-"} / EC {r.water_ec ?? "-"}
                </Table.Td>
                <Table.Td>{r.vpd?.toFixed(2) ?? "-"} kPa</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
