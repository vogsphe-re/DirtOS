import { Button, Checkbox, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  AREA_GENERATION_PRESETS,
  createAreaLayout,
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
};

function formatMeasurement(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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

  const presetData = [{ label: "Custom", value: "" }, ...presetOptions.map((preset) => ({ label: preset.label, value: preset.id }))];

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        <Select
          label="Template"
          value={presetId ?? ""}
          onChange={(value) => applyPreset(value || null)}
          data={presetData}
        />
        {selectedPreset && (
          <Text size="xs" c="dimmed">
            {selectedPreset.description}
          </Text>
        )}
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
        <TextInput
          label="Space label prefix"
          value={labelPrefix}
          onChange={(event) => setLabelPrefix(event.currentTarget.value)}
          placeholder={defaultLabelPrefix}
        />
        {preview.layout ? (
          <Text size="xs" c="dimmed">
            Preview: {preview.layout.rows} rows x {preview.layout.columns} columns · each area is about {formatMeasurement(preview.layout.cellWidthPx / pixelsPerUnit)} x {formatMeasurement(preview.layout.cellHeightPx / pixelsPerUnit)} {unit}
            {preview.layout.actualDensityPerSquareUnit != null
              ? ` · actual density ${formatMeasurement(preview.layout.actualDensityPerSquareUnit)} per square ${unit}`
              : ""}
          </Text>
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