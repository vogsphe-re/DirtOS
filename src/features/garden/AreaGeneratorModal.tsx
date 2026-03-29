import { Accordion, Badge, Box, Button, Card, Checkbox, Group, Modal, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  AREA_GENERATION_PRESETS,
  createAreaLayout,
  getGridCellOffset,
  getGridSpan,
  type AreaGenerationMode,
  type AreaGenerationPresetCategory,
  type AreaGenerationPreset,
  type AreaGenerationSettings,
  type RectGridLayout,
} from "./layoutGeneration";

const DEFAULT_SETTINGS: AreaGenerationSettings = {
  mode: "dimensions",
  areaWidthUnits: 1,
  areaHeightUnits: 1,
  plantingDensity: 1,
  rows: 1,
  columns: 1,
  pathwayWidthXUnits: 0,
  pathwayWidthYUnits: 0,
  pathwayEveryColumns: 0,
  pathwayEveryRows: 0,
};

const PRESET_CATEGORY_ORDER: AreaGenerationPresetCategory[] = ["beds", "blocks", "orchard", "nursery"];

const PRESET_CATEGORY_LABELS: Record<AreaGenerationPresetCategory, string> = {
  beds: "Beds",
  blocks: "Blocks",
  orchard: "Orchard",
  nursery: "Nursery",
};

type PresetFilter = "all" | AreaGenerationPresetCategory;

const CATEGORY_STYLES: Record<AreaGenerationPresetCategory | "custom", {
  soil: string;
  lane: string;
  fill: string;
  stroke: string;
  accent: string;
  badge: string;
  shape: "rect" | "circle";
  radiusFactor: number;
}> = {
  beds: {
    soil: "linear-gradient(180deg, rgba(143,113,61,0.22), rgba(95,71,43,0.10))",
    lane: "rgba(214, 192, 148, 0.48)",
    fill: "rgba(108, 147, 82, 0.74)",
    stroke: "rgba(62, 98, 45, 0.9)",
    accent: "#6c9352",
    badge: "lime",
    shape: "rect",
    radiusFactor: 0.08,
  },
  blocks: {
    soil: "linear-gradient(180deg, rgba(120,95,56,0.22), rgba(74,56,33,0.12))",
    lane: "rgba(228, 206, 156, 0.42)",
    fill: "rgba(78, 125, 78, 0.78)",
    stroke: "rgba(38, 78, 47, 0.92)",
    accent: "#4e7d4e",
    badge: "green",
    shape: "rect",
    radiusFactor: 0.03,
  },
  orchard: {
    soil: "linear-gradient(180deg, rgba(122,104,63,0.22), rgba(79,61,36,0.12))",
    lane: "rgba(206, 188, 136, 0.45)",
    fill: "rgba(74, 121, 66, 0.78)",
    stroke: "rgba(40, 87, 39, 0.92)",
    accent: "#4a7942",
    badge: "teal",
    shape: "circle",
    radiusFactor: 0.45,
  },
  nursery: {
    soil: "linear-gradient(180deg, rgba(87,108,97,0.22), rgba(58,72,64,0.12))",
    lane: "rgba(176, 198, 190, 0.34)",
    fill: "rgba(96, 154, 137, 0.76)",
    stroke: "rgba(48, 103, 90, 0.92)",
    accent: "#609a89",
    badge: "cyan",
    shape: "rect",
    radiusFactor: 0.01,
  },
  custom: {
    soil: "linear-gradient(180deg, rgba(116,102,84,0.18), rgba(76,65,52,0.08))",
    lane: "rgba(198, 182, 150, 0.38)",
    fill: "rgba(95, 138, 89, 0.65)",
    stroke: "rgba(50, 93, 58, 0.85)",
    accent: "#5f8a59",
    badge: "gray",
    shape: "rect",
    radiusFactor: 0.08,
  },
};

function formatMeasurement(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getLaneStarts(count: number, cellSizePx: number, pathwayPx: number, pathwayEvery: number): number[] {
  if (pathwayPx <= 0 || pathwayEvery <= 0) {
    return [];
  }

  const starts: number[] = [];

  for (let marker = pathwayEvery; marker < count; marker += pathwayEvery) {
    starts.push(getGridSpan(marker, cellSizePx, pathwayPx, pathwayEvery));
  }

  return starts;
}

function LayoutDiagram({ layout, category = "custom" }: { layout: RectGridLayout; category?: AreaGenerationPresetCategory | "custom" }) {
  const style = CATEGORY_STYLES[category];
  const maxRows = Math.min(layout.rows, 6);
  const maxColumns = Math.min(layout.columns, 8);
  const visibleWidth = getGridSpan(maxColumns, layout.cellWidthPx, layout.pathwayXPx, layout.pathwayEveryColumns);
  const visibleHeight = getGridSpan(maxRows, layout.cellHeightPx, layout.pathwayYPx, layout.pathwayEveryRows);
  const viewWidth = Math.max(visibleWidth, 1);
  const viewHeight = Math.max(visibleHeight, 1);
  const verticalLaneStarts = getLaneStarts(maxColumns, layout.cellWidthPx, layout.pathwayXPx, layout.pathwayEveryColumns);
  const horizontalLaneStarts = getLaneStarts(maxRows, layout.cellHeightPx, layout.pathwayYPx, layout.pathwayEveryRows);

  return (
    <Box
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--mantine-color-default-border)",
        background: style.soil,
      }}
    >
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} width="100%" height="92" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="rgba(143,113,61,0.16)" />
        {verticalLaneStarts.map((x, index) => (
          <g key={`v-lane-${index}`}>
            <rect x={x} y={0} width={layout.pathwayXPx} height={viewHeight} fill={style.lane} />
            {layout.pathwayXPx >= 16 && (
              <text
                x={x + layout.pathwayXPx / 2}
                y={viewHeight / 2}
                textAnchor="middle"
                fontSize={Math.max(6, Math.min(10, layout.pathwayXPx * 0.35))}
                fill="rgba(93, 69, 33, 0.85)"
                transform={`rotate(-90 ${x + layout.pathwayXPx / 2} ${viewHeight / 2})`}
              >
                lane
              </text>
            )}
          </g>
        ))}
        {horizontalLaneStarts.map((y, index) => (
          <g key={`h-lane-${index}`}>
            <rect x={0} y={y} width={viewWidth} height={layout.pathwayYPx} fill={style.lane} />
            {layout.pathwayYPx >= 14 && (
              <text
                x={viewWidth / 2}
                y={y + layout.pathwayYPx / 2 + 3}
                textAnchor="middle"
                fontSize={Math.max(6, Math.min(10, layout.pathwayYPx * 0.45))}
                fill="rgba(93, 69, 33, 0.85)"
              >
                lane
              </text>
            )}
          </g>
        ))}
        {Array.from({ length: maxRows }, (_, rowIndex) =>
          Array.from({ length: maxColumns }, (_, columnIndex) => {
            const x = getGridCellOffset(columnIndex, layout.cellWidthPx, layout.pathwayXPx, layout.pathwayEveryColumns);
            const y = getGridCellOffset(rowIndex, layout.cellHeightPx, layout.pathwayYPx, layout.pathwayEveryRows);
            const strokeWidth = Math.max(layout.cellWidthPx, layout.cellHeightPx) * 0.02;

            if (style.shape === "circle") {
              return (
                <circle
                  key={`${rowIndex}-${columnIndex}`}
                  cx={x + layout.cellWidthPx / 2}
                  cy={y + layout.cellHeightPx / 2}
                  r={Math.min(layout.cellWidthPx, layout.cellHeightPx) * style.radiusFactor}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={strokeWidth}
                />
              );
            }

            return (
              <rect
                key={`${rowIndex}-${columnIndex}`}
                x={x}
                y={y}
                width={layout.cellWidthPx}
                height={layout.cellHeightPx}
                rx={Math.min(layout.cellWidthPx, layout.cellHeightPx) * style.radiusFactor}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={strokeWidth}
              />
            );
          }),
        )}
      </svg>
    </Box>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: AreaGenerationPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const sampleLayout = useMemo(() => {
    try {
      return createAreaLayout({
        containerWidthPx: 360,
        containerHeightPx: 220,
        pixelsPerUnit: 40,
        ...DEFAULT_SETTINGS,
        ...preset.values,
      });
    } catch {
      return null;
    }
  }, [preset]);

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      onClick={onSelect}
      style={{
        cursor: "pointer",
        borderColor: selected ? "var(--dirtos-accent)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--dirtos-accent) inset" : undefined,
      }}
    >
      <Stack gap="xs">
        {sampleLayout ? <LayoutDiagram layout={sampleLayout} category={preset.category} /> : <Box h={92} />}
        <Group justify="space-between" align="flex-start" gap="xs">
          <Text fw={600} size="sm">{preset.label}</Text>
          <Group gap={4}>
            <Badge size="xs" variant="light" color={CATEGORY_STYLES[preset.category].badge}>{PRESET_CATEGORY_LABELS[preset.category]}</Badge>
            {preset.isPathwayAware && <Badge size="xs" variant="light" color="olive">Pathways</Badge>}
          </Group>
        </Group>
        <Text size="xs" c="dimmed">{preset.description}</Text>
      </Stack>
    </Card>
  );
}

interface AreaGeneratorModalProps {
  opened: boolean;
  onClose: () => void;
  onGenerate: (input: { layout: RectGridLayout; labelPrefix: string; replaceExistingSpaces: boolean }) => void | Promise<void>;
  title: string;
  description: string;
  unit: string;
  pixelsPerUnit: number;
  containerWidthPx: number;
  containerHeightPx: number;
  defaultLabelPrefix?: string;
  submitLabel?: string;
  loading?: boolean;
  allowReplaceExisting?: boolean;
  replaceExistingLabel?: string;
  replaceExistingHelpText?: string;
  presetOptions?: AreaGenerationPreset[];
}

export function AreaGeneratorModal({
  opened,
  onClose,
  onGenerate,
  title,
  description,
  unit,
  pixelsPerUnit,
  containerWidthPx,
  containerHeightPx,
  defaultLabelPrefix = "Space",
  submitLabel = "Create areas",
  loading = false,
  allowReplaceExisting = true,
  replaceExistingLabel = "Replace existing spaces in this plot",
  replaceExistingHelpText = "Replacing spaces also clears any plant assignments currently attached to those spaces.",
  presetOptions = AREA_GENERATION_PRESETS,
}: AreaGeneratorModalProps) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PresetFilter>("all");
  const [settings, setSettings] = useState<AreaGenerationSettings>(DEFAULT_SETTINGS);
  const [labelPrefix, setLabelPrefix] = useState(defaultLabelPrefix);
  const [replaceExistingSpaces, setReplaceExistingSpaces] = useState(true);

  const selectedPreset = presetOptions.find((preset) => preset.id === presetId) ?? null;
  const preview = useMemo<{ layout: RectGridLayout | null; error: string | null }>(() => {
    try {
      return {
        layout: createAreaLayout({
          containerWidthPx,
          containerHeightPx,
          pixelsPerUnit,
          ...settings,
        }),
        error: null,
      };
    } catch (error) {
      return {
        layout: null,
        error: error instanceof Error ? error.message : "Invalid generation settings.",
      };
    }
  }, [containerHeightPx, containerWidthPx, pixelsPerUnit, settings]);

  const applyPreset = (nextPresetId: string | null) => {
    setPresetId(nextPresetId);
    const preset = presetOptions.find((item) => item.id === nextPresetId);
    if (!preset) {
      return;
    }

    setSettings((current) => ({
      ...current,
      mode: preset.values.mode,
      areaWidthUnits: preset.values.areaWidthUnits ?? current.areaWidthUnits,
      areaHeightUnits: preset.values.areaHeightUnits ?? current.areaHeightUnits,
      plantingDensity: preset.values.plantingDensity ?? current.plantingDensity,
      rows: preset.values.rows ?? current.rows,
      columns: preset.values.columns ?? current.columns,
      pathwayWidthXUnits: preset.values.pathwayWidthXUnits ?? current.pathwayWidthXUnits,
      pathwayWidthYUnits: preset.values.pathwayWidthYUnits ?? current.pathwayWidthYUnits,
      pathwayEveryColumns: preset.values.pathwayEveryColumns ?? current.pathwayEveryColumns,
      pathwayEveryRows: preset.values.pathwayEveryRows ?? current.pathwayEveryRows,
    }));

    setActiveFilter(preset.category);

    if (preset.values.labelPrefix) {
      setLabelPrefix(preset.values.labelPrefix);
    }
  };

  const updateSettings = (updates: Partial<AreaGenerationSettings>) => {
    setSettings((current) => ({ ...current, ...updates }));
  };

  const groupedPresets = useMemo(
    () => PRESET_CATEGORY_ORDER
      .map((category) => ({
        category,
        presets: presetOptions.filter((preset) => preset.category === category),
      }))
      .filter((entry) => activeFilter === "all" || entry.category === activeFilter)
      .filter((entry) => entry.presets.length > 0),
    [activeFilter, presetOptions],
  );

  const previewCategory: AreaGenerationPresetCategory | "custom" = selectedPreset?.category ?? (activeFilter === "all" ? "custom" : activeFilter);

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600}>Templates</Text>
            {presetId && (
              <Button variant="subtle" size="compact-xs" onClick={() => applyPreset(null)}>
                Clear preset
              </Button>
            )}
          </Group>
          <SegmentedControl
            fullWidth
            value={activeFilter}
            onChange={(value) => setActiveFilter(value as PresetFilter)}
            data={[
              { label: "All", value: "all" },
              { label: "Beds", value: "beds" },
              { label: "Blocks", value: "blocks" },
              { label: "Orchard", value: "orchard" },
              { label: "Nursery", value: "nursery" },
            ]}
          />
          <Accordion multiple defaultValue={groupedPresets.map((entry) => entry.category)}>
            {groupedPresets.map(({ category, presets }) => (
              <Accordion.Item key={category} value={category}>
                <Accordion.Control>
                  <Group justify="space-between" align="center" w="100%" pr="sm">
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">{PRESET_CATEGORY_LABELS[category]}</Text>
                    <Badge size="xs" variant="dot" color={CATEGORY_STYLES[category].badge}>{presets.length}</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {presets.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        selected={preset.id === presetId}
                        onSelect={() => applyPreset(preset.id)}
                      />
                    ))}
                  </SimpleGrid>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
          {selectedPreset && (
            <Text size="xs" c="dimmed">
              Selected preset: {PRESET_CATEGORY_LABELS[selectedPreset.category]} / {selectedPreset.label}
            </Text>
          )}
        </Stack>

        <SegmentedControl
          fullWidth
          value={settings.mode}
          onChange={(value) => updateSettings({ mode: value as AreaGenerationMode })}
          data={[
            { label: "Dimensions", value: "dimensions" },
            { label: "Density", value: "density" },
            { label: "Rows x Cols", value: "grid" },
          ]}
        />

        {settings.mode === "dimensions" && (
          <Group grow>
            <NumberInput
              label={`Area width (${unit})`}
              value={settings.areaWidthUnits}
              onChange={(value) => updateSettings({ areaWidthUnits: Number(value) || 0 })}
              min={0.1}
              decimalScale={2}
              required
            />
            <NumberInput
              label={`Area height (${unit})`}
              value={settings.areaHeightUnits}
              onChange={(value) => updateSettings({ areaHeightUnits: Number(value) || 0 })}
              min={0.1}
              decimalScale={2}
              required
            />
          </Group>
        )}

        {settings.mode === "density" && (
          <NumberInput
            label={`Planting density (areas per square ${unit})`}
            value={settings.plantingDensity}
            onChange={(value) => updateSettings({ plantingDensity: Number(value) || 0 })}
            min={0.01}
            decimalScale={3}
            required
          />
        )}

        {settings.mode === "grid" && (
          <Group grow>
            <NumberInput
              label="Rows"
              value={settings.rows}
              onChange={(value) => updateSettings({ rows: Number(value) || 0 })}
              min={1}
              step={1}
              required
            />
            <NumberInput
              label="Columns"
              value={settings.columns}
              onChange={(value) => updateSettings({ columns: Number(value) || 0 })}
              min={1}
              step={1}
              required
            />
          </Group>
        )}

        <Stack gap="xs">
          <Text size="sm" fw={600}>Walking lanes</Text>
          <Group grow>
            <NumberInput
              label={`Lane width after columns (${unit})`}
              value={settings.pathwayWidthXUnits}
              onChange={(value) => updateSettings({ pathwayWidthXUnits: Number(value) || 0 })}
              min={0}
              decimalScale={2}
            />
            <NumberInput
              label="Insert after every N columns"
              value={settings.pathwayEveryColumns}
              onChange={(value) => updateSettings({ pathwayEveryColumns: Number(value) || 0 })}
              min={0}
              step={1}
            />
          </Group>
          <Group grow>
            <NumberInput
              label={`Lane width after rows (${unit})`}
              value={settings.pathwayWidthYUnits}
              onChange={(value) => updateSettings({ pathwayWidthYUnits: Number(value) || 0 })}
              min={0}
              decimalScale={2}
            />
            <NumberInput
              label="Insert after every N rows"
              value={settings.pathwayEveryRows}
              onChange={(value) => updateSettings({ pathwayEveryRows: Number(value) || 0 })}
              min={0}
              step={1}
            />
          </Group>
          <Text size="xs" c="dimmed">
            Set lane width to 0 to disable a direction. Example: width 1 after every 4 columns reserves a 1-{unit} walking lane after each group of 4 planting areas.
          </Text>
        </Stack>

        <TextInput
          label="Space label prefix"
          value={labelPrefix}
          onChange={(event) => setLabelPrefix(event.currentTarget.value)}
          placeholder={defaultLabelPrefix}
        />

        {preview.layout ? (
          <Stack gap="xs">
            <LayoutDiagram layout={preview.layout} category={previewCategory} />
            <Text size="xs" c="dimmed">
              Preview: {preview.layout.rows} rows x {preview.layout.columns} columns · each area is about {formatMeasurement(preview.layout.cellWidthPx / pixelsPerUnit)} x {formatMeasurement(preview.layout.cellHeightPx / pixelsPerUnit)} {unit}
              {(preview.layout.pathwayXPx > 0 || preview.layout.pathwayYPx > 0)
                ? ` · lanes ${formatMeasurement(preview.layout.pathwayXPx / pixelsPerUnit)} x ${formatMeasurement(preview.layout.pathwayYPx / pixelsPerUnit)} ${unit}`
                : ""}
              {preview.layout.actualDensityPerSquareUnit != null
                ? ` · actual density ${formatMeasurement(preview.layout.actualDensityPerSquareUnit)} per square ${unit}`
                : ""}
            </Text>
          </Stack>
        ) : preview.error ? (
          <Text size="xs" c="red">{preview.error}</Text>
        ) : null}

        {allowReplaceExisting && (
          <>
            <Checkbox
              checked={replaceExistingSpaces}
              onChange={(event) => setReplaceExistingSpaces(event.currentTarget.checked)}
              label={replaceExistingLabel}
            />
            <Text size="xs" c="dimmed">
              {replaceExistingHelpText}
            </Text>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            onClick={() => {
              if (!preview.layout) {
                return;
              }

              void onGenerate({
                layout: preview.layout,
                labelPrefix,
                replaceExistingSpaces,
              });
            }}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}