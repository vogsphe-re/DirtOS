import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { Modal } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Harvest, HarvestSummary, NewHarvest, UpdateHarvest, SeedLot } from "../../lib/bindings";
import { AssetTagInline } from "../../components/AssetTagBadge";

const UNIT_OPTIONS = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "oz", label: "Ounces (oz)" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "count", label: "Count (pieces)" },
  { value: "bunch", label: "Bunch" },
  { value: "mL", label: "Milliliters (mL)" },
  { value: "L", label: "Liters (L)" },
];

interface HarvestLogProps {
  plantId: number;
}

export function HarvestLog({ plantId }: HarvestLogProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showSeedLotForm, setShowSeedLotForm] = useState(false);
  const [editingHarvest, setEditingHarvest] = useState<Harvest | null>(null);
  const [editValues, setEditValues] = useState({ quality_rating: "", notes: "", sale_ean: "", sale_asin: "" });

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: harvests = [], isLoading } = useQuery<Harvest[]>({
    queryKey: ["harvests", plantId],
    queryFn: async () => {
      const res = await commands.listHarvests(plantId, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Harvest[];
    },
  });

  const { data: summary } = useQuery<HarvestSummary | null>({
    queryKey: ["harvest-summary", plantId],
    queryFn: async () => {
      const res = await commands.getHarvestSummary(plantId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as HarvestSummary | null;
    },
  });

  const { data: seedLots = [] } = useQuery<SeedLot[]>({
    queryKey: ["seed-lots-plant", plantId],
    queryFn: async () => {
      // Load all seed lots then filter by parent_plant_id
      const res = await commands.listSeedLots(null, null);
      if (res.status === "error") throw new Error(res.error);
      return (res.data as SeedLot[]).filter((s: SeedLot) => s.parent_plant_id === plantId);
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createHarvest = useMutation({
    mutationFn: async (input: NewHarvest) => {
      const res = await commands.createHarvest(input);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Harvest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvests", plantId] });
      queryClient.invalidateQueries({ queryKey: ["harvest-summary", plantId] });
      notifications.show({ message: "Harvest logged.", color: "green" });
      setShowForm(false);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deleteHarvest = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteHarvest(id);
      if (res.status === "error") throw new Error(res.error);
      return res.data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvests", plantId] });
      queryClient.invalidateQueries({ queryKey: ["harvest-summary", plantId] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const updateHarvest = useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateHarvest }) => {
      const res = await commands.updateHarvest(id, input);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Harvest | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvests", plantId] });
      setEditingHarvest(null);
      notifications.show({ message: "Harvest updated.", color: "blue" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (isLoading) return <Loader m="xl" />;

  return (
    <Stack gap="md">
      {/* ── Summary card ─────────────────────────────────────────────────── */}
      {summary && summary.harvest_count > 0 && (
        <Card withBorder p="sm">
          <Title order={5} mb="xs">Season summary</Title>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <SummaryItem label="Total harvests" value={String(summary.harvest_count)} />
            <SummaryItem
              label="Total quantity"
              value={`${summary.total_quantity.toFixed(1)}`}
            />
            <SummaryItem
              label="Avg quality"
              value={summary.avg_quality != null ? `${summary.avg_quality.toFixed(1)} / 5` : "—"}
            />
            <SummaryItem
              label="First harvest"
              value={summary.first_harvest ?? "—"}
            />
          </SimpleGrid>
        </Card>
      )}

      {/* ── Log new harvest ───────────────────────────────────────────────── */}
      <Group>
        <Button
          leftSection={<IconPlus size={14} />}
          size="xs"
          variant="light"
          onClick={() => setShowForm((v) => !v)}
          rightSection={showForm ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          Log harvest
        </Button>
      </Group>
      <Collapse in={showForm}>
        <HarvestForm
          plantId={plantId}
          onSubmit={(v) => createHarvest.mutate(v)}
          isPending={createHarvest.isPending}
        />
      </Collapse>

      {/* ── Harvest table ─────────────────────────────────────────────────── */}
      {harvests.length === 0 ? (
        <Text c="dimmed" size="sm">No harvests recorded yet.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Quality</Table.Th>
              <Table.Th>Tag</Table.Th>
              <Table.Th>Sale Codes</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {harvests.map((h) => (
              <Table.Tr key={h.id}>
                <Table.Td>{h.harvest_date}</Table.Td>
                <Table.Td>
                  {h.quantity != null
                    ? `${h.quantity} ${h.unit ?? ""}`
                    : "—"}
                </Table.Td>
                <Table.Td>
                  {h.quality_rating != null ? (
                    <Badge variant="light" color={qualityColor(h.quality_rating)}>
                      {h.quality_rating}/5
                    </Badge>
                  ) : "—"}
                </Table.Td>
                <Table.Td>
                  {h.asset_id ? <AssetTagInline tag={h.asset_id} /> : "—"}
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {h.sale_ean && <AssetTagInline tag={h.sale_ean} />}
                    {h.sale_asin && <AssetTagInline tag={h.sale_asin} />}
                    {!h.sale_ean && !h.sale_asin && <Text size="xs" c="dimmed">—</Text>}
                  </Stack>
                </Table.Td>
                <Table.Td>{h.notes ?? "—"}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setEditingHarvest(h);
                      setEditValues({
                        quality_rating: h.quality_rating != null ? String(h.quality_rating) : "",
                        notes: h.notes ?? "",
                        sale_ean: h.sale_ean ?? "",
                        sale_asin: h.sale_asin ?? "",
                      });
                    }}
                  >
                    <IconEdit size={12} />
                  </ActionIcon>
                    <IconTrash size={12} />
                  </ActionIcon>
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="subtle"
                    loading={deleteHarvest.isPending}
                    onClick={() => {
                      if (confirm("Delete this harvest record?")) deleteHarvest.mutate(h.id);
                    }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* ── Seed lots ──────────────────────────────────────────────────────── */}
      <Divider label="Seed lots" labelPosition="left" mt="xs" />
      <Group>
        <Button
          leftSection={<IconPlus size={14} />}
          size="xs"
          variant="subtle"
          onClick={() => setShowSeedLotForm((v) => !v)}
          rightSection={
            showSeedLotForm ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
          }
        >
          New seed lot
        </Button>
      </Group>
      <Collapse in={showSeedLotForm}>
        <SeedLotForm
          plantId={plantId}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["seed-lots-plant", plantId] });
            setShowSeedLotForm(false);
            notifications.show({ message: "Seed lot saved.", color: "green" });
          }}
        />
      </Collapse>

      {seedLots.length === 0 ? (
        <Text c="dimmed" size="sm">No seed lots saved for this plant.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Viability</Table.Th>
              <Table.Th>Storage</Table.Th>
              <Table.Th>Collected</Table.Th>
              <Table.Th>Tag</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {seedLots.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.asset_id ?? s.lot_label ?? `Lot #${s.id}`}</Table.Td>
                <Table.Td>{s.quantity ?? "—"}</Table.Td>
                <Table.Td>
                  {s.viability_pct != null ? `${s.viability_pct}%` : "—"}
                </Table.Td>
                <Table.Td>{s.storage_location ?? "—"}</Table.Td>
                <Table.Td>{s.collected_date ?? "—"}</Table.Td>
                <Table.Td>
                  {s.asset_id ? <AssetTagInline tag={s.asset_id} /> : "—"}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* ── Harvest edit modal ─────────────────────────────────────────────── */}
      <Modal
        opened={editingHarvest != null}
        onClose={() => setEditingHarvest(null)}
        title="Edit Harvest"
        size="sm"
      >
        <Stack gap="sm">
          <Select
            label="Quality (1–5)"
            data={[
              { value: "1", label: "1 — Poor" },
              { value: "2", label: "2 — Fair" },
              { value: "3", label: "3 — Good" },
              { value: "4", label: "4 — Very Good" },
              { value: "5", label: "5 — Excellent" },
            ]}
            value={editValues.quality_rating}
            onChange={(v) => setEditValues((prev) => ({ ...prev, quality_rating: v ?? "" }))}
            clearable
          />
          <TextInput
            label="Sale EAN / UPC"
            placeholder="e.g. 0123456789012"
            value={editValues.sale_ean}
            onChange={(e) => setEditValues((prev) => ({ ...prev, sale_ean: e.currentTarget.value }))}
          />
          <TextInput
            label="Sale ASIN"
            placeholder="e.g. B08N5WRWNW"
            value={editValues.sale_asin}
            onChange={(e) => setEditValues((prev) => ({ ...prev, sale_asin: e.currentTarget.value }))}
          />
          <Textarea
            label="Notes"
            autosize
            minRows={2}
            value={editValues.notes}
            onChange={(e) => setEditValues((prev) => ({ ...prev, notes: e.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setEditingHarvest(null)}>Cancel</Button>
            <Button
              size="xs"
              loading={updateHarvest.isPending}
              onClick={() => {
                if (!editingHarvest) return;
                updateHarvest.mutate({
                  id: editingHarvest.id,
                  input: {
                    quality_rating: editValues.quality_rating ? parseInt(editValues.quality_rating, 10) : null,
                    notes: editValues.notes.trim() || null,
                    sale_ean: editValues.sale_ean.trim() || null,
                    sale_asin: editValues.sale_asin.trim() || null,
                  },
                });
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm" fw={600}>{value}</Text>
    </Stack>
  );
}

function qualityColor(rating: number) {
  if (rating >= 4) return "green";
  if (rating >= 3) return "yellow";
  return "red";
}

interface HarvestFormValues {
  harvest_date: string;
  quantity: string;
  unit: string;
  quality_rating: string;
  notes: string;
  sale_ean: string;
  sale_asin: string;
}

function HarvestForm({
  plantId,
  onSubmit,
  isPending,
}: {
  plantId: number;
  onSubmit: (v: NewHarvest) => void;
  isPending: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [values, setValues] = useState<HarvestFormValues>({
    harvest_date: today,
    quantity: "",
    unit: "g",
    quality_rating: "",
    notes: "",
    sale_ean: "",
    sale_asin: "",
  });

  const f = (key: keyof HarvestFormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.currentTarget.value })),
  });

  const handleSubmit = () => {
    if (!values.harvest_date) {
      notifications.show({ message: "Harvest date is required.", color: "red" });
      return;
    }
    onSubmit({
      plant_id: plantId,
      harvest_date: values.harvest_date,
      quantity: values.quantity ? parseFloat(values.quantity) : null,
      unit: values.unit || null,
      quality_rating: values.quality_rating ? parseInt(values.quality_rating, 10) : null,
      notes: values.notes.trim() || null,
      sale_ean: values.sale_ean.trim() || null,
      sale_asin: values.sale_asin.trim() || null,
    });
  };

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <SimpleGrid cols={2} spacing="sm">
          <TextInput label="Harvest date" type="date" required {...f("harvest_date")} />
          <Select
            label="Unit"
            data={UNIT_OPTIONS}
            value={values.unit}
            onChange={(v) => setValues((prev) => ({ ...prev, unit: v ?? "g" }))}
          />
          <TextInput
            label="Quantity"
            type="number"
            placeholder="0.0"
            {...f("quantity")}
          />
          <Select
            label="Quality (1–5)"
            data={[
              { value: "1", label: "1 — Poor" },
              { value: "2", label: "2 — Fair" },
              { value: "3", label: "3 — Good" },
              { value: "4", label: "4 — Very Good" },
              { value: "5", label: "5 — Excellent" },
            ]}
            value={values.quality_rating}
            onChange={(v) => setValues((prev) => ({ ...prev, quality_rating: v ?? "" }))}
            clearable
          />
        </SimpleGrid>
        <SimpleGrid cols={2} spacing="sm">
          <TextInput label="Sale EAN / UPC" placeholder="e.g. 0123456789012" {...f("sale_ean")} />
          <TextInput label="Sale ASIN" placeholder="e.g. B08N5WRWNW" {...f("sale_asin")} />
        </SimpleGrid>
        <Textarea label="Notes" autosize minRows={2} {...f("notes")} />
        <Group justify="flex-end">
          <Button size="xs" onClick={handleSubmit} loading={isPending}>
            Save harvest
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function SeedLotForm({
  plantId,
  onCreated,
}: {
  plantId: number;
  onCreated: () => void;
}) {
  const [values, setValues] = useState({
    lot_label: "",
    quantity: "",
    viability_pct: "",
    storage_location: "",
    collected_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [isPending, setIsPending] = useState(false);

  const f = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.currentTarget.value })),
  });

  const handleSubmit = async () => {
    setIsPending(true);
    try {
      const res = await commands.createSeedLot(
        plantId,
        null,
        values.lot_label.trim() || null,
        values.quantity ? parseFloat(values.quantity) : null,
        values.viability_pct ? parseFloat(values.viability_pct) : null,
        values.storage_location.trim() || null,
        values.collected_date || null,
        values.notes.trim() || null,
      );
      if (res.status === "error") throw new Error(res.error);
      onCreated();
    } catch (err) {
      notifications.show({ title: "Error", message: String(err), color: "red" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <SimpleGrid cols={2} spacing="sm">
          <TextInput label="Lot Name" placeholder="e.g. 2025-tomato-a" {...f("lot_label")} />
          <TextInput label="Collected date" type="date" {...f("collected_date")} />
          <TextInput label="Quantity (seeds)" type="number" {...f("quantity")} />
          <TextInput label="Viability %" type="number" placeholder="0–100" {...f("viability_pct")} />
          <TextInput label="Storage location" {...f("storage_location")} />
        </SimpleGrid>
        <Textarea label="Notes" autosize minRows={2} {...f("notes")} />
        <Group justify="flex-end">
          <Button size="xs" onClick={handleSubmit} loading={isPending}>
            Save seed lot
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
