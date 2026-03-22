import {
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { PlantJournalTab } from "../journal/PlantJournalTab";
import { HarvestLog } from "./HarvestLog";
import { GenealogyView } from "./GenealogyView";
import type { Plant, PlantStatus, Species } from "./types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "./types";

interface PlantDetailProps {
  plantId: number;
}

export function PlantDetail({ plantId }: PlantDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: plant, isLoading, isError } = useQuery({
    queryKey: ["plant", plantId],
    queryFn: async () => {
      const res = await (commands as any).getPlant(plantId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant | null;
    },
  });

  const { data: species } = useQuery({
    queryKey: ["species", plant?.species_id],
    queryFn: async () => {
      if (!plant?.species_id) return null;
      const res = await (commands as any).getSpecies(plant.species_id);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species | null;
    },
    enabled: !!plant?.species_id,
  });

  const changeStatus = useMutation({
    mutationFn: async (status: PlantStatus) => {
      const res = await (commands as any).changePlantStatus(plantId, status);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant", plantId] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Status updated.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deletePlant = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).deletePlant(plantId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Plant deleted.", color: "orange" });
      navigate({ to: "/plants/individuals" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (isLoading) return <Loader m="xl" />;
  if (isError || !plant) return <Text c="red" p="md">Plant not found.</Text>;

  return (
    <Stack p="md" gap="md">
      <Group>
        <Tooltip label="Back to plants">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate({ to: "/plants/individuals" })}
          >
            Plants
          </Button>
        </Tooltip>
      </Group>

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>{plant.name}</Title>
          {plant.label && <Text c="dimmed">{plant.label}</Text>}
          {species && (
            <Text
              size="sm"
              c="green"
              style={{ cursor: "pointer" }}
              onClick={() =>
                navigate({ to: "/plants/$speciesId", params: { speciesId: String(species.id) } })
              }
            >
              {species.common_name}
              {species.scientific_name && ` (${species.scientific_name})`}
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          <Select
            size="xs"
            value={plant.status}
            data={Object.entries(PLANT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => v && changeStatus.mutate(v as PlantStatus)}
            w={140}
          />
          <Tooltip label="Delete plant">
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              loading={deletePlant.isPending}
              onClick={() => {
                if (confirm(`Delete plant "${plant.name}"?`)) deletePlant.mutate();
              }}
            >
              Delete
            </Button>
          </Tooltip>
        </Group>
      </Group>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="fields">Custom Fields</Tabs.Tab>
          <Tabs.Tab value="journal">Journal</Tabs.Tab>
          <Tabs.Tab value="issues">Issues</Tabs.Tab>
          <Tabs.Tab value="harvest">Harvest</Tabs.Tab>
          <Tabs.Tab value="genealogy">Genealogy</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          {editing ? (
            <PlantEditForm
              plant={plant}
              onSaved={(_updated) => {
                queryClient.invalidateQueries({ queryKey: ["plant", plantId] });
                queryClient.invalidateQueries({ queryKey: ["plants-all"] });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <Stack gap="sm">
              <Group justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconEdit size={14} />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              </Group>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                <InfoItem
                  label="Status"
                  value={
                    <Badge color={PLANT_STATUS_COLORS[plant.status]} variant="light">
                      {PLANT_STATUS_LABELS[plant.status]}
                    </Badge>
                  }
                />
                <InfoItem label="Planted date" value={plant.planted_date} />
                <InfoItem label="Germinated date" value={plant.germinated_date} />
                <InfoItem label="Transplanted date" value={plant.transplanted_date} />
                <InfoItem label="Removed date" value={plant.removed_date} />
                <InfoItem label="Purchase source" value={plant.purchase_source} />
                <InfoItem label="Purchase date" value={plant.purchase_date} />
                <InfoItem
                  label="Purchase price"
                  value={plant.purchase_price != null ? `$${plant.purchase_price.toFixed(2)}` : null}
                />
              </SimpleGrid>
              {plant.notes && (
                <>
                  <Divider />
                  <Text size="sm">{plant.notes}</Text>
                </>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="fields" pt="md">
          <CustomFieldsEditor entityType="plant" entityId={plantId} />
        </Tabs.Panel>

        <Tabs.Panel value="journal" pt="md">
          <PlantJournalTab plantId={plantId} />
        </Tabs.Panel>

        <Tabs.Panel value="issues" pt="md">
          <Text c="dimmed" py="md">Issues — Phase 4</Text>
        </Tabs.Panel>

        <Tabs.Panel value="harvest" pt="md">
          <HarvestLog plantId={plantId} />
        </Tabs.Panel>

        <Tabs.Panel value="genealogy" pt="md">
          {plant && <GenealogyView plant={plant} />}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null | React.ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      {value ? (
        typeof value === "string" ? (
          <Text size="sm">{value}</Text>
        ) : (
          value
        )
      ) : (
        <Text size="sm" c="dimmed">—</Text>
      )}
    </Stack>
  );
}

// ————————————————————————————————————————————
// Inline edit form
// ————————————————————————————————————————————
function PlantEditForm({
  plant,
  onSaved,
  onCancel,
}: {
  plant: Plant;
  onSaved: (updated: Plant) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    name: plant.name,
    label: plant.label ?? "",
    planted_date: plant.planted_date ?? "",
    germinated_date: plant.germinated_date ?? "",
    transplanted_date: plant.transplanted_date ?? "",
    removed_date: plant.removed_date ?? "",
    purchase_source: plant.purchase_source ?? "",
    purchase_date: plant.purchase_date ?? "",
    purchase_price: plant.purchase_price != null ? String(plant.purchase_price) : "",
    notes: plant.notes ?? "",
  });

  const [speciesId, setSpeciesId] = useState<string | null>(
    plant.species_id ? String(plant.species_id) : null,
  );

  const { data: speciesList = [] } = useQuery({
    queryKey: ["species-all-edit"],
    queryFn: async () => {
      const res = await (commands as any).listSpecies(null, null, null, null, 500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).updatePlant(plant.id, {
        species_id: speciesId ? parseInt(speciesId) : null,
        location_id: null,
        status: null,
        name: values.name.trim() || null,
        label: values.label.trim() || null,
        planted_date: values.planted_date || null,
        germinated_date: values.germinated_date || null,
        transplanted_date: values.transplanted_date || null,
        removed_date: values.removed_date || null,
        parent_plant_id: null,
        seed_lot_id: null,
        purchase_source: values.purchase_source.trim() || null,
        purchase_date: values.purchase_date || null,
        purchase_price: values.purchase_price ? parseFloat(values.purchase_price) : null,
        notes: values.notes.trim() || null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: onSaved,
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const f = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.currentTarget.value })),
  });

  return (
    <Stack gap="sm">
      <SimpleGrid cols={2} spacing="sm">
        <TextInput label="Name" required {...f("name")} />
        <TextInput label="Label / tag" {...f("label")} />
        <Select
          label="Species"
          searchable
          clearable
          data={speciesList.map((sp) => ({
            value: String(sp.id),
            label: sp.common_name + (sp.scientific_name ? ` (${sp.scientific_name})` : ""),
          }))}
          value={speciesId}
          onChange={setSpeciesId}
        />
        <TextInput label="Planted date" type="date" {...f("planted_date")} />
        <TextInput label="Germinated date" type="date" {...f("germinated_date")} />
        <TextInput label="Transplanted date" type="date" {...f("transplanted_date")} />
        <TextInput label="Removed date" type="date" {...f("removed_date")} />
        <TextInput label="Purchase source" {...f("purchase_source")} />
        <TextInput label="Purchase date" type="date" {...f("purchase_date")} />
        <TextInput label="Purchase price" type="number" {...f("purchase_price")} />
      </SimpleGrid>
      <Textarea label="Notes" autosize minRows={2} {...f("notes")} />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
