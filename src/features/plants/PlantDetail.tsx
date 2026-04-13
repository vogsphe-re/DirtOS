import {
  Badge,
  Button,
  Checkbox,
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
import { IconArrowLeft, IconArrowsTransferUp, IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands, type Location, type SeedlingTray, type SeedlingTrayCell } from "../../lib/bindings";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { PlantJournalTab } from "../journal/PlantJournalTab";
import { HarvestLog } from "./HarvestLog";
import { GenealogyView } from "./GenealogyView";
import type { Plant, PlantStatus, Species } from "./types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "./types";
import { AssetTagBadge } from "../../components/AssetTagBadge";
import { TransplantAssignmentModal } from "./TransplantAssignmentModal";
import { LogObservationModal } from "./SeedlingPlanner";

interface PlantDetailProps {
  plantId: number;
  from?: string;
}

type LocationNavigationTarget = "/plants/trays" | "/garden/plots";

interface PlantLocationInfo {
  label: string;
  navigationTarget: LocationNavigationTarget | null;
}

interface CanvasObjectReference {
  id: string;
  type: string;
  label: string;
  parentId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCanvasObjects(canvasJson: string | null): CanvasObjectReference[] {
  if (!canvasJson) return [];

  try {
    const parsed = JSON.parse(canvasJson);
    if (!isRecord(parsed)) return [];
    const objects = parsed.objects;
    if (!Array.isArray(objects)) return [];

    return objects
      .filter((value): value is Record<string, unknown> => isRecord(value) && typeof value.id === "string")
      .map((value) => ({
        id: String(value.id),
        type: typeof value.type === "string" ? value.type : "",
        label: typeof value.label === "string" ? value.label : "",
        parentId: typeof value.parentId === "string" ? value.parentId : null,
      }));
  } catch {
    return [];
  }
}

function getLocationNavigationTarget(location: Location): LocationNavigationTarget | null {
  if (location.location_type === "SeedlingArea") return "/plants/trays";
  if (
    location.location_type === "Space"
    || location.location_type === "PlotGroup"
    || location.location_type === "OutdoorSite"
  ) {
    return "/garden/plots";
  }
  return null;
}

export function PlantDetail({ plantId, from }: PlantDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [transplantOpen, setTransplantOpen] = useState(false);
  const [logObsOpen, setLogObsOpen] = useState(false);

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

  const { data: locationInfo = { label: "Unassigned", navigationTarget: null }, isLoading: locationLoading } = useQuery<PlantLocationInfo>({
    queryKey: ["plant-location-label", plant?.id, plant?.environment_id, plant?.location_id, plant?.canvas_object_id],
    queryFn: async () => {
      if (!plant) return { label: "Unassigned", navigationTarget: null };

      const locationsRes = await commands.listLocations(plant.environment_id);
      if (locationsRes.status === "error") throw new Error(locationsRes.error);
      const locations = locationsRes.data as Location[];
      const locationsById = new Map<number, Location>(locations.map((location) => [location.id, location]));

      const traysRes = await commands.listSeedlingTrays(plant.environment_id);
      if (traysRes.status === "error") throw new Error(traysRes.error);
      const trays = traysRes.data as SeedlingTray[];

      for (const tray of trays) {
        const cellsRes = await commands.listSeedlingTrayCells(tray.id);
        if (cellsRes.status === "error") continue;

        const cells = cellsRes.data as SeedlingTrayCell[];
        const match = cells.find((cell) => cell.plant_id === plant.id);
        if (!match) continue;

        const areaName = tray.location_id != null ? locationsById.get(tray.location_id)?.name : null;
        const trayLabel = `${tray.name} - Row ${match.row + 1}, Col ${match.col + 1}`;
        return {
          label: areaName ? `${areaName} / ${trayLabel}` : trayLabel,
          navigationTarget: "/plants/trays",
        };
      }

      if (plant.canvas_object_id) {
        const canvasRes = await commands.loadCanvas(plant.environment_id);
        if (canvasRes.status === "ok") {
          const canvasObjects = parseCanvasObjects(canvasRes.data);
          const canvasObjectsById = new Map(canvasObjects.map((object) => [object.id, object]));

          const spaceObject = canvasObjectsById.get(plant.canvas_object_id);
          if (spaceObject) {
            const spaceLabel = spaceObject.label.trim() || "Canvas space";
            const plotObject = spaceObject.parentId ? canvasObjectsById.get(spaceObject.parentId) : undefined;
            const plotLabel = plotObject?.label.trim() || null;

            return {
              label: plotLabel ? `${plotLabel} / ${spaceLabel}` : spaceLabel,
              navigationTarget: "/garden/plots",
            };
          }
        }

        return {
          label: "Assigned on Garden Canvas",
          navigationTarget: "/garden/plots",
        };
      }

      if (plant.location_id != null) {
        const location = locationsById.get(plant.location_id);
        if (location) {
          return {
            label: location.label ? `${location.name} (${location.label})` : location.name,
            navigationTarget: getLocationNavigationTarget(location),
          };
        }
        return { label: `Location #${plant.location_id}`, navigationTarget: null };
      }

      return { label: "Unassigned", navigationTarget: null };
    },
    enabled: !!plant,
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

  const toggleHarvestable = useMutation({
    mutationFn: async (nextValue: boolean) => {
      const fn = nextValue ? (commands as any).markHarvestable : (commands as any).unmarkHarvestable;
      const res = await fn(plantId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant", plantId] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Harvestable flag updated.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const cyclePerennial = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).cyclePerennialPlant(plantId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant", plantId] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({ message: "Plant moved back to seedling stage.", color: "green" });
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

  const effectiveLifecycle = plant.lifecycle_override ?? species?.growth_type ?? null;
  const canCyclePerennial =
    effectiveLifecycle?.toLowerCase() === "perennial" && plant.status === "harvested";

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
        {from === "plots" && (
          <Tooltip label="Back to Outdoor Plot Manager">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate({ to: "/garden/plots" })}
            >
              Plot Manager
            </Button>
          </Tooltip>
        )}
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
          <Checkbox
            size="xs"
            label="Harvestable"
            checked={plant.is_harvestable}
            onChange={(event) => toggleHarvestable.mutate(event.currentTarget.checked)}
            disabled={toggleHarvestable.isPending}
          />
          {canCyclePerennial && (
            <Button
              size="xs"
              variant="light"
              color="grape"
              loading={cyclePerennial.isPending}
              onClick={() => cyclePerennial.mutate()}
            >
              Cycle to Seedling
            </Button>
          )}
          {(plant.status === "seedling" || plant.status === "active") && (
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconArrowsTransferUp size={14} />}
              onClick={() => setTransplantOpen(true)}
            >
              {plant.status === "active" ? "Move" : "Transplant"}
            </Button>
          )}
          {plant.status === "seedling" && (
            <Button
              size="xs"
              variant="light"
              color="teal"
              onClick={() => setLogObsOpen(true)}
            >
              Log Growth
            </Button>
          )}
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
              {plant.asset_id && (
                <AssetTagBadge tag={plant.asset_id} label={plant.name} />
              )}
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                <InfoItem
                  label="Status"
                  value={
                    <Badge color={PLANT_STATUS_COLORS[plant.status]} variant="light">
                      {PLANT_STATUS_LABELS[plant.status]}
                    </Badge>
                  }
                />
                <InfoItem
                  label="Location"
                  value={
                    locationLoading
                      ? "Resolving..."
                      : locationInfo.navigationTarget
                        ? (
                          <Text
                            size="sm"
                            c="blue"
                            td="underline"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate({ to: locationInfo.navigationTarget as LocationNavigationTarget })}
                          >
                            {locationInfo.label}
                          </Text>
                        )
                        : locationInfo.label
                  }
                />
                <InfoItem label="Lifecycle" value={effectiveLifecycle} />
                <InfoItem label="Harvestable" value={plant.is_harvestable ? "Yes" : "No"} />
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

      <TransplantAssignmentModal
        opened={transplantOpen}
        environmentId={plant.environment_id}
        plant={plant}
        onClose={() => setTransplantOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["plant", plantId] });
          queryClient.invalidateQueries({ queryKey: ["plant-location-label", plant.id] });
          setTransplantOpen(false);
        }}
      />

      {logObsOpen && (
        <LogObservationModal
          plant={plant}
          opened={logObsOpen}
          onClose={() => setLogObsOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["seedling-obs"] });
            setLogObsOpen(false);
          }}
        />
      )}
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
  const lifecycleOptions = [
    { value: "__species__", label: "Use species default" },
    { value: "annual", label: "Annual" },
    { value: "perennial", label: "Perennial" },
    { value: "biennial", label: "Biennial" },
  ];

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
    lifecycle_override: plant.lifecycle_override ?? "__species__",
    notes: plant.notes ?? "",
  });
  const [isHarvestable, setIsHarvestable] = useState(plant.is_harvestable);

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
        is_harvestable: isHarvestable,
        lifecycle_override:
          values.lifecycle_override === "__species__"
            ? null
            : values.lifecycle_override,
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
        <Select
          label="Lifecycle Override"
          data={lifecycleOptions}
          value={values.lifecycle_override}
          onChange={(value) => setValues((prev) => ({ ...prev, lifecycle_override: value ?? "__species__" }))}
        />
        <Checkbox
          mt="xl"
          label="Harvestable"
          checked={isHarvestable}
          onChange={(event) => setIsHarvestable(event.currentTarget.checked)}
        />
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
