import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastItem } from "../../lib/bindings";
import { useUnits } from "../../lib/units";

interface Props {
  hourly: ForecastItem[];
}

function formatHour(dt: number) {
  const d = new Date(dt * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ForecastChart({ hourly }: Props) {
  const fmt = useUnits();

  const data = hourly.map((h) => ({
    time: formatHour(h.dt),
    // Store display-unit temp so axis + tooltip are consistent
    temp: (() => {
      const raw = fmt.tempShort(h.temperature_c);
      return parseFloat(raw.replace("°", ""));
    })(),
    precip: h.precipitation_mm ? Math.round(h.precipitation_mm * 10) / 10 : 0,
    precipDisplay: fmt.precip(h.precipitation_mm ?? 0),
    pop: h.precipitation_prob ? Math.round(h.precipitation_prob * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "var(--mantine-color-dimmed)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="temp"
          orientation="left"
          tick={{ fontSize: 11, fill: "var(--mantine-color-dimmed)" }}
          tickLine={false}
          axisLine={false}
          unit={fmt.tempUnit}
        />
        <YAxis
          yAxisId="precip"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--mantine-color-dimmed)" }}
          tickLine={false}
          axisLine={false}
          unit={fmt.precipUnit}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value, name) => {
            if (name === "temp") return [`${value}${fmt.tempUnit}`, "Temp"];
            if (name === "precip") return [`${value} ${fmt.precipUnit}`, "Precip"];
            return [value, name];
          }}
        />
        <Bar
          yAxisId="precip"
          dataKey="precip"
          fill="var(--mantine-color-blue-5)"
          opacity={0.85}
          name="precip"
          radius={[2, 2, 0, 0]}
        />
        <Area
          yAxisId="temp"
          type="monotone"
          dataKey="temp"
          stroke="var(--mantine-color-orange-5)"
          fill="var(--mantine-color-orange-2)"
          strokeWidth={2}
          dot={false}
          name="temp"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
