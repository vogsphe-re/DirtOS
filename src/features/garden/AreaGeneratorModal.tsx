import { Badge, Box, Button, Card, Checkbox, Group, Modal, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  AREA_GENERATION_PRESETS,
  createAreaLayout,
  getGridCellOffset,
  getGridSpan,
  type AreaGenerationMode,
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

function formatMeasurement(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function LayoutDiagram({ layout }: { layout: RectGridLayout }) {
  const maxRows = Math.min(layout.rows, 6);
  const maxColumns = Math.min(layout.columns, 8);
  const visibleWidth = getGridSpan(maxColumns, layout.cellWidthPx, layout.pathwayXPx, layout.pathwayEveryColumns);
  const visibleHeight = getGridSpan(maxRows, layout.cellHeightPx, layout.pathwayYPx, layout.pathwayEveryRows);
  const viewWidth = Math.max(visibleWidth, 1);
  const viewHeight = Math.max(visibleHeight, 1);

  return (
    <Box
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--mantine-color-default-border)",
        background: "linear-gradient(180deg, rgba(143,113,61,0.18), rgba(95,71,43,0.08))",
      }}
    >
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} width="100%" height="92" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="rgba(143,113,61,0.16)" />
        {Array.from({ length: maxRows }, (_, rowIndex) =>
          Array.from({ length: maxColumns }, (_, columnIndex) => (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={getGridCellOffset(columnIndex, layout.cellWidthPx, layout.pathwayXPx, layout.pathwayEveryColumns)}
              y={getGridCellOffset(rowIndex, layout.cellHeightPx, layout.pathwayYPx, layout.pathwayEveryRows)}
              width={layout.cellWidthPx}
              height={layout.cellHeightPx}
              rx={Math.min(layout.cellWidthPx, layout.cellHeightPx) * 0.08}
              fill="rgba(95, 138, 89, 0.65)"
              stroke="rgba(50, 93, 58, 0.85)"
              strokeWidth={Math.max(layout.cellWidthPx, layout.cellHeightPx) * 0.02}
            />
          )),
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
        {sampleLayout ? <LayoutDiagram layout={sampleLayout} /> : <Box h={92} />}
        <Group justify="space-between" align="flex-start" gap="xs">
          <Text fw={600} size="sm">{preset.label}</Text>
          {preset.isPathwayAware && <Badge size="xs" variant="light" color="olive">Pathways</Badge>}
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
    }));

    if (preset.values.labelPrefix) {
      setLabelPrefix(preset.values.labelPrefix);
    }
  };

  const updateSettings = (updates: Partial<AreaGenerationSettings>) => {
    setSettings((current) => ({ ...current, ...updates }));
  };

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
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {presetOptions.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={preset.id === presetId}
                onSelect={() => applyPreset(preset.id)}
              />
            ))}
          </SimpleGrid>
          {selectedPreset && (
            <Text size="xs" c="dimmed">
              Selected preset: {selectedPreset.label}
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
            <LayoutDiagram layout={preview.layout} />
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