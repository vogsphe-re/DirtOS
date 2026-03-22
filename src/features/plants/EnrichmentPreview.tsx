import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Image,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type {
  ApplyEnrichmentFields,
  EnrichmentPreviewResult,
} from "../../lib/bindings";
import type { Species } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  inaturalist: "iNaturalist",
  wikipedia: "Wikipedia",
  eol: "Encyclopedia of Life",
  gbif: "GBIF",
  trefle: "Trefle",
};

const SOURCE_COLORS: Record<string, string> = {
  inaturalist: "green",
  wikipedia: "gray",
  eol: "teal",
  gbif: "grape",
  trefle: "green",
};

interface EnrichmentPreviewProps {
  opened: boolean;
  onClose: () => void;
  speciesId: number;
  species: Species;
  preview: EnrichmentPreviewResult | null;
}

export function EnrichmentPreview({
  opened,
  onClose,
  speciesId,
  species,
  preview,
}: EnrichmentPreviewProps) {
  const queryClient = useQueryClient();

  // Track which fields the user has approved (all on by default)
  const [approvedFields, setApprovedFields] = useState<Set<string>>(new Set());

  // Reset approvals when preview changes
  const prevSourceRef = useState<string | null>(null);
  if (
    preview &&
    prevSourceRef[0] !== `${preview.source}-${preview.source_id}`
  ) {
    prevSourceRef[1](`${preview.source}-${preview.source_id}`);
    setApprovedFields(new Set(preview.fields.map((f) => f.field)));
  }

  const toggleField = (fieldName: string) => {
    setApprovedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (approvedFields.size === preview.fields.length) {
      setApprovedFields(new Set());
    } else {
      setApprovedFields(new Set(preview.fields.map((f) => f.field)));
    }
  };

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview data");

      // Build the ApplyEnrichmentFields payload with all field values
      const input: ApplyEnrichmentFields = {
        source: preview.source,
        approved_fields: Array.from(approvedFields),
        cached_json: preview.cached_json,
        source_id: preview.source_id,
        // Set all possible field values from the preview
        scientific_name: fieldValue("scientific_name"),
        family: fieldValue("family"),
        genus: fieldValue("genus"),
        image_url: fieldValue("image_url"),
        description: fieldValue("description"),
        eol_description: fieldValue("eol_description"),
        growth_type: fieldValue("growth_type"),
        sun_requirement: fieldValue("sun_requirement"),
        water_requirement: fieldValue("water_requirement"),
        soil_ph_min: fieldNumValue("soil_ph_min"),
        soil_ph_max: fieldNumValue("soil_ph_max"),
        spacing_cm: fieldNumValue("spacing_cm"),
        days_to_harvest_min: fieldIntValue("days_to_harvest_min"),
        days_to_harvest_max: fieldIntValue("days_to_harvest_max"),
        hardiness_zone_min: fieldValue("hardiness_zone_min"),
        hardiness_zone_max: fieldValue("hardiness_zone_max"),
        habitat: fieldValue("habitat"),
        native_range: fieldValue("native_range"),
        establishment_means: fieldValue("establishment_means"),
        min_temperature_c: fieldNumValue("min_temperature_c"),
        max_temperature_c: fieldNumValue("max_temperature_c"),
        rooting_depth: fieldValue("rooting_depth"),
        uses: fieldValue("uses"),
        tags: fieldValue("tags"),
        gbif_accepted_name: fieldValue("gbif_accepted_name"),
      };

      const res = await commands.applyEnrichmentPreview(speciesId, input);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      const sourceName =
        SOURCE_LABELS[preview?.source ?? ""] ?? preview?.source ?? "External";
      notifications.show({
        title: "Enriched",
        message: `${sourceName} data applied (${approvedFields.size} field${approvedFields.size === 1 ? "" : "s"}).`,
        color: "green",
      });
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({
        title: "Enrichment error",
        message: err.message,
        color: "red",
      }),
  });

  // Helpers to extract field values from the preview
  function fieldValue(name: string): string | null {
    const f = preview?.fields.find((p) => p.field === name);
    return f?.new_value ?? null;
  }

  function fieldNumValue(name: string): number | null {
    const v = fieldValue(name);
    if (v == null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function fieldIntValue(name: string): number | null {
    const v = fieldValue(name);
    if (v == null) return null;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }

  if (!preview) return null;

  const sourceLabel = SOURCE_LABELS[preview.source] ?? preview.source;
  const sourceColor = SOURCE_COLORS[preview.source] ?? "blue";
  const allChecked = approvedFields.size === preview.fields.length;
  const noneChecked = approvedFields.size === 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>Enrichment Preview</Text>
          <Badge color={sourceColor} variant="light" size="sm">
            {sourceLabel}
          </Badge>
        </Group>
      }
      size="lg"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Review the data below. Uncheck any fields you don't want to apply to{" "}
          <Text span fw={500}>
            {species.common_name}
          </Text>
          .
        </Text>
        <Divider />

        {preview.fields.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            No new data available from this source.
          </Text>
        ) : (
          <>
            <Group justify="space-between">
              <Checkbox
                label={allChecked ? "Deselect all" : "Select all"}
                checked={allChecked}
                indeterminate={!allChecked && !noneChecked}
                onChange={toggleAll}
                size="xs"
              />
              <Text size="xs" c="dimmed">
                {approvedFields.size} of {preview.fields.length} fields selected
              </Text>
            </Group>

            <Table
              withTableBorder
              withColumnBorders={false}
              verticalSpacing="xs"
              highlightOnHover
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40} />
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Current</Table.Th>
                  <Table.Th>New</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.fields.map((f) => {
                  const isApproved = approvedFields.has(f.field);
                  const isOverwrite =
                    f.current_value != null && f.current_value !== "";
                  return (
                    <Table.Tr
                      key={f.field}
                      style={{
                        opacity: isApproved ? 1 : 0.5,
                        cursor: "pointer",
                      }}
                      onClick={() => toggleField(f.field)}
                    >
                      <Table.Td>
                        <Checkbox
                          checked={isApproved}
                          onChange={() => toggleField(f.field)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Text size="sm" fw={500}>
                            {f.label}
                          </Text>
                          {isOverwrite && (
                            <Tooltip label="Will overwrite existing value">
                              <Badge
                                color="orange"
                                variant="light"
                                size="xs"
                              >
                                overwrite
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <FieldValueCell value={f.current_value} field={f.field} />
                      </Table.Td>
                      <Table.Td>
                        <FieldValueCell value={f.new_value} field={f.field} isNew />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </>
        )}

        <Divider />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} leftSection={<IconX size={14} />}>
            Cancel
          </Button>
          <Button
            onClick={() => applyMut.mutate()}
            loading={applyMut.isPending}
            disabled={noneChecked}
            leftSection={<IconCheck size={14} />}
            color={sourceColor}
          >
            Apply {approvedFields.size} field{approvedFields.size === 1 ? "" : "s"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function FieldValueCell({
  value,
  field,
  isNew,
}: {
  value: string | null;
  field: string;
  isNew?: boolean;
}) {
  if (value == null || value === "") {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        —
      </Text>
    );
  }

  // For image fields, show a thumbnail
  if (field === "image_url") {
    return (
      <Group gap={4} align="center">
        <Image src={value} w={32} h={32} radius="sm" fit="cover" />
        <Text size="xs" c="dimmed" lineClamp={1} maw={120}>
          {value.split("/").pop()}
        </Text>
      </Group>
    );
  }

  // Truncate long text values
  const maxLen = 120;
  const display = value.length > maxLen ? value.slice(0, maxLen) + "…" : value;
  return (
    <Text
      size="xs"
      c={isNew ? undefined : "dimmed"}
      fw={isNew ? 500 : undefined}
      lineClamp={3}
    >
      {display}
    </Text>
  );
}
