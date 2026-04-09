import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { commands } from "../../lib/bindings";

type OverlayTool =
  | "light"
  | "intake"
  | "exhaust"
  | "reservoir"
  | "fan"
  | "co2"
  | "drain";

type CanvasObject = {
  id: string;
  type: OverlayTool;
  xPct: number;
  yPct: number;
  size: number;
  rotationDeg?: number;
};

type Props = {
  locationId: number;
  widthCm?: number | null;
  depthCm?: number | null;
  lightWattage?: number | null;
};

type PersistedCanvasPayload = {
  version: 1;
  scale: number;
  showCeiling: boolean;
  showVentilation: boolean;
  showPlumbing: boolean;
  objects: CanvasObject[];
};

const TOOL_LABELS: Record<OverlayTool, string> = {
  light: "Light Fixture",
  intake: "Intake",
  exhaust: "Exhaust",
  reservoir: "Reservoir",
  fan: "Fan",
  co2: "CO2",
  drain: "Drainage",
};

const TOOL_ICONS: Record<OverlayTool, string> = {
  light: "💡",
  intake: "⬇",
  exhaust: "⬆",
  reservoir: "🟦",
  fan: "🌀",
  co2: "🫧",
  drain: "↘",
};

function coverageRadiusPx(lightWattage: number | null | undefined, scale = 1): number {
  if (!lightWattage) return 60 * scale;
  return Math.max(45 * scale, Math.min(120 * scale, (lightWattage / 6) * scale));
}

export function IndoorCanvasTools({
  locationId,
  widthCm,
  depthCm,
  lightWattage,
}: Props) {
  const [activeTool, setActiveTool] = useState<OverlayTool>("light");
  const [scale, setScale] = useState(1);
  const [showCeiling, setShowCeiling] = useState(true);
  const [showVentilation, setShowVentilation] = useState(true);
  const [showPlumbing, setShowPlumbing] = useState(true);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  const locationQuery = useQuery({
    queryKey: ["location-canvas", locationId],
    queryFn: async () => {
      const res = await commands.getLocation(locationId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!locationId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: PersistedCanvasPayload) => {
      const res = await commands.updateLocation(locationId, {
        parent_id: null,
        location_type: null,
        name: null,
        label: null,
        position_x: null,
        position_y: null,
        width: null,
        height: null,
        canvas_data_json: JSON.stringify(payload),
        notes: null,
        grid_rows: null,
        grid_cols: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  useEffect(() => {
    if (!locationQuery.data || hasHydrated) return;
    const raw = locationQuery.data.canvas_data_json;
    if (!raw) {
      setHasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedCanvasPayload | CanvasObject[];
      if (Array.isArray(parsed)) {
        setObjects(parsed);
      } else {
        setObjects(parsed.objects ?? []);
        setScale(parsed.scale ?? 1);
        setShowCeiling(parsed.showCeiling ?? true);
        setShowVentilation(parsed.showVentilation ?? true);
        setShowPlumbing(parsed.showPlumbing ?? true);
      }
    } catch {
      setObjects([]);
    }
    setHasHydrated(true);
  }, [hasHydrated, locationQuery.data]);

  useEffect(() => {
    if (!hasHydrated) return;
    const payload: PersistedCanvasPayload = {
      version: 1,
      scale,
      showCeiling,
      showVentilation,
      showPlumbing,
      objects,
    };

    const timer = setTimeout(() => {
      saveMutation.mutate(payload);
    }, 350);

    return () => clearTimeout(timer);
  }, [hasHydrated, objects, saveMutation, scale, showCeiling, showPlumbing, showVentilation]);

  const board = useMemo(() => {
    const w = widthCm ?? 120;
    const d = depthCm ?? 120;
    const ratio = d > 0 ? w / d : 1;
    const baseWidth = 560;
    const baseHeight = Math.max(260, Math.round(baseWidth / ratio));
    return { w: baseWidth, h: baseHeight };
  }, [depthCm, widthCm]);

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Indoor Canvas Tools</Text>
          <Group gap="xs">
            <Badge variant="light">
              {Math.round(widthCm ?? 120)} x {Math.round(depthCm ?? 120)} cm
            </Badge>
            <Badge color={saveMutation.isError ? "red" : saveMutation.isPending ? "yellow" : "green"} variant="light">
              {saveMutation.isError ? "Save failed" : saveMutation.isPending ? "Saving" : "Synced"}
            </Badge>
          </Group>
        </Group>

        <Group grow>
          <Select
            label="Placement Tool"
            value={activeTool}
            data={(Object.keys(TOOL_LABELS) as OverlayTool[]).map((k) => ({
              value: k,
              label: TOOL_LABELS[k],
            }))}
            onChange={(v) => setActiveTool((v as OverlayTool | null) ?? "light")}
          />
          <div>
            <Text size="sm" mb={6}>
              Overlay Scale
            </Text>
            <Slider
              min={0.6}
              max={1.6}
              step={0.1}
              value={scale}
              onChange={setScale}
            />
          </div>
        </Group>

        <Group>
          <Switch label="Ceiling Layer" checked={showCeiling} onChange={(e) => setShowCeiling(e.currentTarget.checked)} />
          <Switch label="Ventilation Layer" checked={showVentilation} onChange={(e) => setShowVentilation(e.currentTarget.checked)} />
          <Switch label="Plumbing Layer" checked={showPlumbing} onChange={(e) => setShowPlumbing(e.currentTarget.checked)} />
        </Group>

        <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: board.h,
            border: "1px solid var(--mantine-color-gray-4)",
            borderRadius: 8,
            background:
              "repeating-linear-gradient(0deg, #f8f9fa 0, #f8f9fa 19px, #e9ecef 20px), repeating-linear-gradient(90deg, #f8f9fa 0, #f8f9fa 19px, #e9ecef 20px)",
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPct = ((e.clientX - rect.left) / rect.width) * 100;
            const yPct = ((e.clientY - rect.top) / rect.height) * 100;
            const obj: CanvasObject = {
              id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
              type: activeTool,
              xPct,
              yPct,
              size: activeTool === "reservoir" ? 54 : 36,
              rotationDeg: activeTool === "intake" ? 180 : 0,
            };
            setObjects((prev) => [...prev, obj]);
          }}
        >
          {objects.map((obj) => {
            const isCeiling = obj.type === "light";
            const isVent = obj.type === "intake" || obj.type === "exhaust" || obj.type === "fan";
            const isPlumbing = obj.type === "reservoir" || obj.type === "drain";

            if ((isCeiling && !showCeiling) || (isVent && !showVentilation) || (isPlumbing && !showPlumbing)) {
              return null;
            }

            const x = `${obj.xPct}%`;
            const y = `${obj.yPct}%`;
            const radius = obj.type === "light" ? coverageRadiusPx(lightWattage, scale) : obj.size * scale;

            return (
              <div key={obj.id}>
                {obj.type === "light" && (
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: y,
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(255, 224, 102, 0.35), rgba(255, 224, 102, 0.06) 60%, rgba(255, 224, 102, 0))",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: obj.size,
                    height: obj.size,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--mantine-color-gray-5)",
                    background: "var(--dirtos-bg)",
                    transform: `translate(-50%, -50%) rotate(${obj.rotationDeg ?? 0}deg)`,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  title={`${TOOL_LABELS[obj.type]} (double-click to remove)`}
                  onDoubleClick={(ev) => {
                    ev.stopPropagation();
                    setObjects((prev) => prev.filter((p) => p.id !== obj.id));
                  }}
                >
                  {TOOL_ICONS[obj.type]}
                </div>
                {(obj.type === "intake" || obj.type === "exhaust" || obj.type === "fan") && (
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: y,
                      width: 68,
                      borderTop: "2px dashed rgba(80,120,180,.75)",
                      transform: `translate(0, -50%) rotate(${obj.rotationDeg ?? 0}deg)`,
                      transformOrigin: "left center",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            Click inside the board to place {TOOL_LABELS[activeTool].toLowerCase()} items. Double-click an item to remove.
          </Text>
          <Button variant="default" size="xs" onClick={() => setObjects([])}>
            Clear All
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
