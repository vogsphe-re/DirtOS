import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLeaf, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Species, TaxonResult } from "./types";

interface AddSpeciesModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (species: Species) => void;
}

// ----- Manual form -----
interface ManualFormValues {
  common_name: string;
  scientific_name: string;
  family: string;
  genus: string;
  growth_type: string;
  sun_requirement: string;
  water_requirement: string;
  days_to_harvest_min: string;
  days_to_harvest_max: string;
  description: string;
  image_url: string;
}

export function AddSpeciesModal({ opened, onClose, onCreated }: AddSpeciesModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Species"
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Tabs defaultValue="search">
        <Tabs.List>
          <Tabs.Tab value="search" leftSection={<IconSearch size={14} />}>
            Search iNaturalist
          </Tabs.Tab>
          <Tabs.Tab value="manual" leftSection={<IconLeaf size={14} />}>
            Manual entry
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="search" pt="md">
          <InatSearchTab onCreated={onCreated} />
        </Tabs.Panel>

        <Tabs.Panel value="manual" pt="md">
          <ManualEntryTab onCreated={onCreated} onClose={onClose} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

// ————————————————————————————————————————————
// iNaturalist search tab
// ————————————————————————————————————————————
function InatSearchTab({ onCreated }: { onCreated: (species: Species) => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["inat-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [] as TaxonResult[];
      const res = await (commands as any).searchInaturalist(searchQuery);
      if (res.status === "error") throw new Error(res.error);
      return res.data as TaxonResult[];
    },
    enabled: !!searchQuery,
  });

  const createFromTaxon = useMutation({
    mutationFn: async (taxon: TaxonResult) => {
      const res = await (commands as any).createSpecies({
        common_name: taxon.preferred_common_name ?? taxon.name,
        scientific_name: taxon.name,
        family: null,
        genus: null,
        growth_type: null,
        sun_requirement: null,
        water_requirement: null,
        soil_ph_min: null,
        soil_ph_max: null,
        spacing_cm: null,
        days_to_germination_min: null,
        days_to_germination_max: null,
        days_to_harvest_min: null,
        days_to_harvest_max: null,
        hardiness_zone_min: null,
        hardiness_zone_max: null,
        description: null,
        image_url: taxon.default_photo_url ?? null,
        is_user_added: true,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species;
    },
    onSuccess: async (created) => {
      // Auto-enrich with iNaturalist after creation
      notifications.show({ message: "Species created. Fetching iNaturalist data…", color: "blue" });
      try {
        const enrichRes = await (commands as any).enrichSpeciesInaturalist(created.id);
        if (enrichRes.status === "ok") {
          queryClient.invalidateQueries({ queryKey: ["species"] });
          onCreated(enrichRes.data as Species);
          notifications.show({ title: "Done", message: "Species added and enriched.", color: "green" });
        } else {
          onCreated(created);
        }
      } catch {
        onCreated(created);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Stack gap="sm">
      <Group>
        <TextInput
          placeholder="e.g. tomato, Solanum lycopersicum…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearchQuery(query);
          }}
        />
        <Button
          onClick={() => setSearchQuery(query)}
          loading={isFetching}
          leftSection={<IconSearch size={14} />}
        >
          Search
        </Button>
      </Group>

      {results.map((taxon) => (
        <Card key={taxon.id} withBorder padding="xs">
          <Group wrap="nowrap" gap="sm">
            {taxon.default_photo_url ? (
              <Image
                src={taxon.default_photo_url}
                w={48}
                h={48}
                radius="sm"
                fit="cover"
                flex="none"
              />
            ) : (
              <IconLeaf size={48} stroke={0.8} style={{ flexShrink: 0 }} />
            )}
            <Stack gap={2} flex={1}>
              <Text fw={500}>
                {taxon.preferred_common_name ?? taxon.name}
              </Text>
              <Text size="xs" fs="italic" c="dimmed">
                {taxon.name}
              </Text>
              {taxon.rank && (
                <Badge size="xs" variant="outline">
                  {taxon.rank}
                </Badge>
              )}
            </Stack>
            <Button
              size="xs"
              variant="light"
              loading={createFromTaxon.isPending}
              onClick={() => createFromTaxon.mutate(taxon)}
            >
              Add
            </Button>
          </Group>
        </Card>
      ))}

      {searchQuery && results.length === 0 && !isFetching && (
        <Text ta="center" c="dimmed">
          No results for "{searchQuery}".
        </Text>
      )}
    </Stack>
  );
}

// ————————————————————————————————————————————
// Manual entry tab
// ————————————————————————————————————————————
function ManualEntryTab({
  onCreated,
  onClose,
}: {
  onCreated: (species: Species) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ManualFormValues>({
    common_name: "",
    scientific_name: "",
    family: "",
    genus: "",
    growth_type: "",
    sun_requirement: "",
    water_requirement: "",
    days_to_harvest_min: "",
    days_to_harvest_max: "",
    description: "",
    image_url: "",
  });
  const [errors, setErrors] = useState<Partial<ManualFormValues>>({});

  const createMutation = useMutation({
    mutationFn: async () => {
      const errs: Partial<ManualFormValues> = {};
      if (!values.common_name.trim()) errs.common_name = "Common name is required";
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        throw new Error("Validation failed");
      }
      setErrors({});

      const res = await (commands as any).createSpecies({
        common_name: values.common_name.trim(),
        scientific_name: values.scientific_name.trim() || null,
        family: values.family.trim() || null,
        genus: values.genus.trim() || null,
        growth_type: values.growth_type || null,
        sun_requirement: values.sun_requirement || null,
        water_requirement: values.water_requirement || null,
        soil_ph_min: null,
        soil_ph_max: null,
        spacing_cm: null,
        days_to_germination_min: null,
        days_to_germination_max: null,
        days_to_harvest_min: values.days_to_harvest_min
          ? parseInt(values.days_to_harvest_min)
          : null,
        days_to_harvest_max: values.days_to_harvest_max
          ? parseInt(values.days_to_harvest_max)
          : null,
        hardiness_zone_min: null,
        hardiness_zone_max: null,
        description: values.description.trim() || null,
        image_url: values.image_url.trim() || null,
        is_user_added: true,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species;
    },
    onSuccess: (sp) => {
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Created", message: `${sp.common_name} added.`, color: "green" });
      onCreated(sp);
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed")
        notifications.show({ title: "Error", message: err.message, color: "red" });
    },
  });

  const field = (key: keyof ManualFormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.currentTarget.value })),
    error: errors[key],
  });

  return (
    <Stack gap="sm">
      <TextInput label="Common name" required {...field("common_name")} />
      <TextInput label="Scientific name" {...field("scientific_name")} />
      <SimpleGrid cols={2} spacing="sm">
        <TextInput label="Family" {...field("family")} />
        <TextInput label="Genus" {...field("genus")} />
      </SimpleGrid>
      <SimpleGrid cols={3} spacing="sm">
        <Select
          label="Growth type"
          data={["annual", "perennial", "biennial", "tree", "shrub", "vine", "herb"]}
          value={values.growth_type || null}
          onChange={(v) => setValues((prev) => ({ ...prev, growth_type: v ?? "" }))}
          clearable
        />
        <Select
          label="Sun"
          data={["full_sun", "partial_sun", "shade"]}
          value={values.sun_requirement || null}
          onChange={(v) => setValues((prev) => ({ ...prev, sun_requirement: v ?? "" }))}
          clearable
        />
        <Select
          label="Water"
          data={["low", "medium", "high"]}
          value={values.water_requirement || null}
          onChange={(v) => setValues((prev) => ({ ...prev, water_requirement: v ?? "" }))}
          clearable
        />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="sm">
        <TextInput
          label="Days to harvest (min)"
          type="number"
          {...field("days_to_harvest_min")}
        />
        <TextInput
          label="Days to harvest (max)"
          type="number"
          {...field("days_to_harvest_max")}
        />
      </SimpleGrid>
      <Textarea label="Description" autosize minRows={2} {...field("description")} />
      <TextInput label="Image URL" {...field("image_url")} />

      <Group justify="flex-end" mt="sm">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          loading={createMutation.isPending}
        >
          Save species
        </Button>
      </Group>
    </Stack>
  );
}
