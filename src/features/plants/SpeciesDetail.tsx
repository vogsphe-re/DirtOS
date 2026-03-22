import {
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBrandWikipedia,
  IconEdit,
  IconExternalLink,
  IconGlobe,
  IconLeaf,
  IconPlant,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type {
  WikiSearchResult,
  EolSearchResult,
  GbifSearchResult,
  TrefleSearchResult,
  EnrichmentPreviewResult,
} from "../../lib/bindings";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { EnrichmentPreview } from "./EnrichmentPreview";
import { AddPlantModal } from "./AddPlantModal";
import type { Plant, Species } from "./types";
import { PLANT_STATUS_COLORS, PLANT_STATUS_LABELS } from "./types";

interface SpeciesDetailProps {
  speciesId: number;
}

export function SpeciesDetail({ speciesId }: SpeciesDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addPlantOpen, setAddPlantOpen] = useState(false);
  const [wikiPickerOpen, setWikiPickerOpen] = useState(false);
  const [wikiCandidates, setWikiCandidates] = useState<WikiSearchResult[]>([]);
  const [eolPickerOpen, setEolPickerOpen] = useState(false);
  const [eolCandidates, setEolCandidates] = useState<EolSearchResult[]>([]);
  const [gbifPickerOpen, setGbifPickerOpen] = useState(false);
  const [gbifCandidates, setGbifCandidates] = useState<GbifSearchResult[]>([]);
  const [treflePickerOpen, setTreflePickerOpen] = useState(false);
  const [trefleCandidates, setTrefleCandidates] = useState<TrefleSearchResult[]>([]);

  // Edit / Delete state
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Enrichment preview state
  const [enrichPreviewOpen, setEnrichPreviewOpen] = useState(false);
  const [enrichPreview, setEnrichPreview] = useState<EnrichmentPreviewResult | null>(null);

  const { data: species, isLoading, isError } = useQuery({
    queryKey: ["species", speciesId],
    queryFn: async () => {
      const res = await (commands as any).getSpecies(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species | null;
    },
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["plants-by-species", speciesId],
    queryFn: async () => {
      const res = await (commands as any).listPlantsBySpecies(speciesId, 200, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
  });

  // --- iNaturalist: preview-based enrichment ---
  const enrichInat = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).previewEnrichInaturalist(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as EnrichmentPreviewResult;
    },
    onSuccess: (preview: EnrichmentPreviewResult) => {
      if (preview.fields.length === 0) {
        notifications.show({ title: "No new data", message: "iNaturalist returned no new fields.", color: "orange" });
      } else {
        setEnrichPreview(preview);
        setEnrichPreviewOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "iNaturalist error", message: err.message, color: "red" }),
  });

  const searchWikiCandidates = useMutation({
    mutationFn: async () => {
      const res = await commands.searchWikipediaCandidates(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (candidates) => {
      if (candidates.length === 0) {
        notifications.show({
          title: "No results",
          message: "No Wikipedia articles found for this species.",
          color: "orange",
        });
      } else if (candidates.length === 1) {
        // Single result — show preview instead of auto-enriching
        previewWiki.mutate(candidates[0].slug);
      } else {
        setWikiCandidates(candidates);
        setWikiPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Wikipedia search error", message: err.message, color: "red" }),
  });

  const previewWiki = useMutation({
    mutationFn: async (slug: string) => {
      const res = await commands.previewEnrichWikipedia(speciesId, slug);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (preview: EnrichmentPreviewResult) => {
      setWikiPickerOpen(false);
      if (preview.fields.length === 0) {
        notifications.show({ title: "No new data", message: "Wikipedia returned no new fields.", color: "orange" });
      } else {
        setEnrichPreview(preview);
        setEnrichPreviewOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Wikipedia error", message: err.message, color: "red" }),
  });

  const searchEolCandidates = useMutation({
    mutationFn: async () => {
      const res = await commands.searchEolCandidates(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (candidates) => {
      if (candidates.length === 0) {
        notifications.show({
          title: "No results",
          message: "No Encyclopedia of Life pages found for this species.",
          color: "orange",
        });
      } else if (candidates.length === 1) {
        previewEol.mutate(candidates[0].id);
      } else {
        setEolCandidates(candidates);
        setEolPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "EoL search error", message: err.message, color: "red" }),
  });

  const previewEol = useMutation({
    mutationFn: async (eolPageId: number) => {
      const res = await commands.previewEnrichEol(speciesId, eolPageId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (preview: EnrichmentPreviewResult) => {
      setEolPickerOpen(false);
      if (preview.fields.length === 0) {
        notifications.show({ title: "No new data", message: "EoL returned no new fields.", color: "orange" });
      } else {
        setEnrichPreview(preview);
        setEnrichPreviewOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "EoL error", message: err.message, color: "red" }),
  });

  const searchGbifCandidates = useMutation({
    mutationFn: async () => {
      const res = await commands.searchGbifCandidates(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (candidates) => {
      if (candidates.length === 0) {
        notifications.show({
          title: "No results",
          message: "No GBIF backbone taxa found for this species.",
          color: "orange",
        });
      } else if (candidates.length === 1) {
        previewGbif.mutate(candidates[0].key);
      } else {
        setGbifCandidates(candidates);
        setGbifPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "GBIF search error", message: err.message, color: "red" }),
  });

  const previewGbif = useMutation({
    mutationFn: async (gbifKey: number) => {
      const res = await commands.previewEnrichGbif(speciesId, gbifKey);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (preview: EnrichmentPreviewResult) => {
      setGbifPickerOpen(false);
      if (preview.fields.length === 0) {
        notifications.show({ title: "No new data", message: "GBIF returned no new fields.", color: "orange" });
      } else {
        setEnrichPreview(preview);
        setEnrichPreviewOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "GBIF error", message: err.message, color: "red" }),
  });

  const searchTrefleCandidates = useMutation({
    mutationFn: async () => {
      const res = await commands.searchTrefleCandidates(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (candidates) => {
      if (candidates.length === 0) {
        notifications.show({
          title: "No results",
          message: "No Trefle plants found for this species.",
          color: "orange",
        });
      } else if (candidates.length === 1) {
        previewTrefle.mutate(candidates[0].id);
      } else {
        setTrefleCandidates(candidates);
        setTreflePickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Trefle search error", message: err.message, color: "red" }),
  });

  const previewTrefle = useMutation({
    mutationFn: async (trefleId: number) => {
      const res = await commands.previewEnrichTrefle(speciesId, trefleId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (preview: EnrichmentPreviewResult) => {
      setTreflePickerOpen(false);
      if (preview.fields.length === 0) {
        notifications.show({ title: "No new data", message: "Trefle returned no new fields.", color: "orange" });
      } else {
        setEnrichPreview(preview);
        setEnrichPreviewOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Trefle error", message: err.message, color: "red" }),
  });

  // --- Delete species ---
  const deleteSpecies = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).deleteSpecies(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Deleted", message: "Species removed.", color: "orange" });
      navigate({ to: "/plants" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Delete error", message: err.message, color: "red" }),
  });

  // --- Update species (edit form) ---
  const updateSpecies = useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const res = await (commands as any).updateSpecies(speciesId, input);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Saved", message: "Species updated.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Update error", message: err.message, color: "red" }),
  });

  if (isLoading) return <Loader m="xl" />;
  if (isError || !species)
    return <Text c="red" p="md">Species not found.</Text>;

  const plantRows = plants.map((p) => (
    <Table.Tr
      key={p.id}
      style={{ cursor: "pointer" }}
      onClick={() =>
        navigate({ to: "/plants/individuals/$plantId", params: { plantId: String(p.id) } })
      }
    >
      <Table.Td>{p.name}</Table.Td>
      <Table.Td>
        <Badge color={PLANT_STATUS_COLORS[p.status]} variant="light" size="sm">
          {PLANT_STATUS_LABELS[p.status]}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{p.planted_date ?? "—"}</Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack p="md" gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Tooltip label="Back to catalog">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate({ to: "/plants" })}
          >
            Catalog
          </Button>
        </Tooltip>
        <Group gap="xs">
          <Tooltip label="Edit species">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip label="Delete species">
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
          </Tooltip>
        </Group>
      </Group>

      <Group align="flex-start" wrap="nowrap" gap="xl">
        {species.image_url ? (
          <Image
            src={species.image_url}
            w={120}
            h={120}
            radius="md"
            fit="cover"
            flex="none"
          />
        ) : (
          <IconPlant size={80} stroke={0.8} style={{ flexShrink: 0 }} />
        )}
        <Stack gap={4} flex={1}>
          <Title order={2}>{species.common_name}</Title>
          {species.scientific_name && (
            <Text fs="italic" c="dimmed">
              {species.scientific_name}
            </Text>
          )}
          <Group gap="xs" mt={4}>
            {species.family && <Badge variant="outline" size="sm">{species.family}</Badge>}
            {species.growth_type && <Badge variant="outline" size="sm">{species.growth_type}</Badge>}
            {species.sun_requirement && (
              <Badge variant="light" color="yellow" size="sm">
                {species.sun_requirement.replace("_", " ")}
              </Badge>
            )}
            {species.water_requirement && (
              <Badge variant="light" color="blue" size="sm">
                {species.water_requirement} water
              </Badge>
            )}
          </Group>
          <Group gap="xs" mt={8}>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconLeaf size={14} />}
              loading={enrichInat.isPending}
              onClick={() => enrichInat.mutate()}
            >
              Enrich from iNaturalist
            </Button>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconBrandWikipedia size={14} />}
              loading={searchWikiCandidates.isPending || previewWiki.isPending}
              onClick={() => searchWikiCandidates.mutate()}
            >
              Enrich from Wikipedia
            </Button>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconPlant size={14} />}
              loading={searchEolCandidates.isPending || previewEol.isPending}
              onClick={() => searchEolCandidates.mutate()}
            >
              Enrich from EoL
            </Button>
            <Button
              size="xs"
              variant="light"
              color="grape"
              leftSection={<IconGlobe size={14} />}
              loading={searchGbifCandidates.isPending || previewGbif.isPending}
              onClick={() => searchGbifCandidates.mutate()}
            >
              Enrich from GBIF
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconLeaf size={14} />}
              loading={searchTrefleCandidates.isPending || previewTrefle.isPending}
              onClick={() => searchTrefleCandidates.mutate()}
            >
              Enrich from Trefle
            </Button>
          </Group>
        </Stack>
      </Group>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="growing">Growing Info</Tabs.Tab>
          <Tabs.Tab value="plants">
            Individual Plants{plants.length > 0 ? ` (${plants.length})` : ""}
          </Tabs.Tab>
          <Tabs.Tab value="notes">Notes & Fields</Tabs.Tab>
        </Tabs.List>

        {/* Overview */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="sm">
            {species.description && (
              <Text>{species.description}</Text>
            )}
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              <InfoItem label="Family" value={species.family} />
              <InfoItem label="Genus" value={species.genus} />
              <InfoItem label="Scientific name" value={species.scientific_name} />
              <InfoItem
                label="iNaturalist ID"
                value={
                  species.inaturalist_id ? (
                    <Anchor
                      href={`https://www.inaturalist.org/taxa/${species.inaturalist_id}`}
                      target="_blank"
                      size="sm"
                    >
                      {species.inaturalist_id} <IconExternalLink size={12} />
                    </Anchor>
                  ) : null
                }
              />
              <InfoItem
                label="Wikipedia"
                value={
                  species.wikipedia_slug ? (
                    <Anchor
                      href={`https://en.wikipedia.org/wiki/${species.wikipedia_slug}`}
                      target="_blank"
                      size="sm"
                    >
                      {species.wikipedia_slug} <IconExternalLink size={12} />
                    </Anchor>
                  ) : null
                }
              />
              <InfoItem
                label="GBIF"
                value={
                  species.gbif_key ? (
                    <Anchor
                      href={`https://www.gbif.org/species/${species.gbif_key}`}
                      target="_blank"
                      size="sm"
                    >
                      {species.gbif_accepted_name ?? species.gbif_key} <IconExternalLink size={12} />
                    </Anchor>
                  ) : null
                }
              />
              <InfoItem label="Native range" value={species.native_range} />
              <InfoItem label="Establishment" value={species.establishment_means} />
            </SimpleGrid>
            {species.tags && (() => {
              let parsed: string[] = [];
              try { parsed = JSON.parse(species.tags); } catch {}
              return parsed.length > 0 ? (
                <Group gap="xs" mt="xs">
                  {parsed.map((tag) => (
                    <Badge key={tag} variant="light" color="teal" size="sm">{tag}</Badge>
                  ))}
                </Group>
              ) : null;
            })()}
          </Stack>
        </Tabs.Panel>

        {/* Growing Info */}
        <Tabs.Panel value="growing" pt="md">
          <Stack gap="md">
            {species.eol_description && (
              <Stack gap={4}>
                <Text size="sm" fw={600} c="dimmed">Summary (Encyclopedia of Life)</Text>
                <Text size="sm">{species.eol_description}</Text>
                <Divider />
              </Stack>
            )}
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              <InfoItem label="Growth form" value={species.growth_type} />
              <InfoItem label="Sun requirement" value={species.sun_requirement} />
              <InfoItem label="Water requirement" value={species.water_requirement} />
              <InfoItem label="Habitat" value={species.habitat} />
              <InfoItem
                label="Soil pH"
                value={
                  species.soil_ph_min != null
                    ? `${species.soil_ph_min}${species.soil_ph_max ? `–${species.soil_ph_max}` : ""}`
                    : null
                }
              />
              <InfoItem
                label="Temperature (°C)"
                value={
                  species.min_temperature_c != null
                    ? `${species.min_temperature_c.toFixed(1)}${species.max_temperature_c != null ? `–${species.max_temperature_c.toFixed(1)}` : ""}`
                    : species.max_temperature_c != null
                      ? `≤ ${species.max_temperature_c.toFixed(1)}`
                      : null
                }
              />
              <InfoItem label="Hardiness zone min" value={species.hardiness_zone_min} />
              <InfoItem label="Hardiness zone max" value={species.hardiness_zone_max} />
              <InfoItem label="Rooting depth" value={species.rooting_depth} />
              <InfoItem label="Uses" value={species.uses} />
              <InfoItem
                label="Spacing (cm)"
                value={species.spacing_cm?.toString()}
              />
              <InfoItem
                label="Days to germination"
                value={
                  species.days_to_germination_min != null
                    ? `${species.days_to_germination_min}${species.days_to_germination_max ? `–${species.days_to_germination_max}` : ""}`
                    : null
                }
              />
              <InfoItem
                label="Days to harvest"
                value={
                  species.days_to_harvest_min != null
                    ? `${species.days_to_harvest_min}${species.days_to_harvest_max ? `–${species.days_to_harvest_max}` : ""}`
                    : null
                }
              />
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        {/* Individual Plants */}
        <Tabs.Panel value="plants" pt="md">
          <Stack gap="sm">
            <Group justify="flex-end">
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setAddPlantOpen(true)}
              >
                Add plant
              </Button>
            </Group>
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Planted</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {plantRows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text ta="center" c="dimmed" py="md">
                        No individual plants recorded for this species.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  plantRows
                )}
              </Table.Tbody>
            </Table>
          </Stack>
        </Tabs.Panel>

        {/* Notes & custom fields */}
        <Tabs.Panel value="notes" pt="md">
          <CustomFieldsEditor entityType="species" entityId={speciesId} />
        </Tabs.Panel>
      </Tabs>

      <AddPlantModal
        opened={addPlantOpen}
        onClose={() => setAddPlantOpen(false)}
        defaultSpeciesId={speciesId}
        onCreated={() => {
          setAddPlantOpen(false);
          queryClient.invalidateQueries({ queryKey: ["plants-by-species", speciesId] });
        }}
      />

      {/* Wikipedia article picker */}
      <Modal
        opened={wikiPickerOpen}
        onClose={() => setWikiPickerOpen(false)}
        title="Select Wikipedia article"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Multiple Wikipedia articles matched. Choose the one that best describes this species.
          </Text>
          <Divider />
          {wikiCandidates.map((c) => (
            <Card key={c.slug} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} flex={1}>
                  <Text fw={500} size="sm">{c.title}</Text>
                  {c.description && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {c.description}
                    </Text>
                  )}
                  {c.url && (
                    <Anchor href={c.url} target="_blank" size="xs">
                      {c.url} <IconExternalLink size={11} />
                    </Anchor>
                  )}
                </Stack>
                <Button
                  size="xs"
                  variant="light"
                  loading={previewWiki.isPending && previewWiki.variables === c.slug}
                  onClick={() => previewWiki.mutate(c.slug)}
                >
                  Use this
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>

      {/* Encyclopedia of Life page picker */}
      <Modal
        opened={eolPickerOpen}
        onClose={() => setEolPickerOpen(false)}
        title="Select Encyclopedia of Life page"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Multiple EoL pages matched. Choose the one that best describes this species.
          </Text>
          <Divider />
          {eolCandidates.map((c) => (
            <Card key={c.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} flex={1}>
                  <Text fw={500} size="sm">{c.title}</Text>
                  {c.snippet && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {c.snippet}
                    </Text>
                  )}
                  {c.link && (
                    <Anchor href={c.link} target="_blank" size="xs">
                      {c.link} <IconExternalLink size={11} />
                    </Anchor>
                  )}
                </Stack>
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  loading={previewEol.isPending && previewEol.variables === c.id}
                  onClick={() => previewEol.mutate(c.id)}
                >
                  Use this
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>

      {/* GBIF backbone taxon picker */}
      <Modal
        opened={gbifPickerOpen}
        onClose={() => setGbifPickerOpen(false)}
        title="Select GBIF backbone taxon"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Multiple GBIF taxa matched. Choose the one that best describes this species.
          </Text>
          <Divider />
          {gbifCandidates.map((c) => (
            <Card key={c.key} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} flex={1}>
                  <Text fw={500} size="sm">{c.scientific_name}</Text>
                  {c.canonical_name && c.canonical_name !== c.scientific_name && (
                    <Text size="xs" fs="italic" c="dimmed">{c.canonical_name}</Text>
                  )}
                  <Group gap="xs">
                    {c.rank && <Badge size="xs" variant="outline">{c.rank}</Badge>}
                    {c.status && <Badge size="xs" variant="light">{c.status}</Badge>}
                    {c.confidence != null && (
                      <Badge size="xs" variant="light" color="grape">
                        {c.confidence}% match
                      </Badge>
                    )}
                  </Group>
                  {c.classification && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {c.classification}
                    </Text>
                  )}
                  <Anchor
                    href={`https://www.gbif.org/species/${c.key}`}
                    target="_blank"
                    size="xs"
                  >
                    gbif.org/species/{c.key} <IconExternalLink size={11} />
                  </Anchor>
                </Stack>
                <Button
                  size="xs"
                  variant="light"
                  color="grape"
                  loading={previewGbif.isPending && previewGbif.variables === c.key}
                  onClick={() => previewGbif.mutate(c.key)}
                >
                  Use this
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>

      {/* Trefle plant picker */}
      <Modal
        opened={treflePickerOpen}
        onClose={() => setTreflePickerOpen(false)}
        title="Select Trefle plant"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Multiple Trefle plants matched. Choose the one that best describes this species.
          </Text>
          <Divider />
          {trefleCandidates.map((c) => (
            <Card key={c.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} flex={1}>
                  <Text fw={500} size="sm" fs="italic">{c.scientific_name}</Text>
                  {c.common_name && (
                    <Text size="xs" c="dimmed">{c.common_name}</Text>
                  )}
                  <Group gap="xs">
                    {c.family && <Badge size="xs" variant="outline">{c.family}</Badge>}
                    {c.genus && <Badge size="xs" variant="light">{c.genus}</Badge>}
                  </Group>
                  <Anchor
                    href={`https://trefle.io/api/v1/plants/${c.id}`}
                    target="_blank"
                    size="xs"
                  >
                    trefle.io/plants/{c.id} <IconExternalLink size={11} />
                  </Anchor>
                </Stack>
                {c.image_url && (
                  <Image src={c.image_url} w={50} h={50} radius="sm" fit="cover" />
                )}
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  loading={previewTrefle.isPending && previewTrefle.variables === c.id}
                  onClick={() => previewTrefle.mutate(c.id)}
                >
                  Use this
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete species"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Delete <Text span fw={600}>{species.common_name}</Text>?
            {plants.length > 0 && (
              <Text size="sm" c="orange" mt={4}>
                {plants.length} individual plant{plants.length === 1 ? "" : "s"} will
                have their species reference cleared.
              </Text>
            )}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteSpecies.isPending}
              onClick={() => deleteSpecies.mutate()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit species modal */}
      <SpeciesEditModal
        opened={editing}
        onClose={() => setEditing(false)}
        species={species}
        onSave={(fields) => updateSpecies.mutate(fields)}
        saving={updateSpecies.isPending}
      />

      {/* Enrichment field-level preview */}
      <EnrichmentPreview
        opened={enrichPreviewOpen}
        onClose={() => setEnrichPreviewOpen(false)}
        speciesId={speciesId}
        species={species}
        preview={enrichPreview}
      />
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
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      {value ? (
        typeof value === "string" ? (
          <Text size="sm">{value}</Text>
        ) : (
          value
        )
      ) : (
        <Text size="sm" c="dimmed">
          —
        </Text>
      )}
    </Stack>
  );
}

const SUN_OPTIONS = [
  { value: "full_sun", label: "Full sun" },
  { value: "partial_sun", label: "Partial sun" },
  { value: "shade", label: "Shade" },
];

const WATER_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const GROWTH_OPTIONS = [
  { value: "annual", label: "Annual" },
  { value: "perennial", label: "Perennial" },
  { value: "biennial", label: "Biennial" },
  { value: "tree", label: "Tree" },
  { value: "shrub", label: "Shrub" },
  { value: "vine", label: "Vine" },
  { value: "herb", label: "Herb" },
];

function SpeciesEditModal({
  opened,
  onClose,
  species,
  onSave,
  saving,
}: {
  opened: boolean;
  onClose: () => void;
  species: Species;
  onSave: (fields: Record<string, any>) => void;
  saving: boolean;
}) {
  const [commonName, setCommonName] = useState(species.common_name);
  const [scientificName, setScientificName] = useState(species.scientific_name ?? "");
  const [family, setFamily] = useState(species.family ?? "");
  const [genus, setGenus] = useState(species.genus ?? "");
  const [growthType, setGrowthType] = useState<string | null>(species.growth_type ?? null);
  const [sunReq, setSunReq] = useState<string | null>(species.sun_requirement ?? null);
  const [waterReq, setWaterReq] = useState<string | null>(species.water_requirement ?? null);
  const [desc, setDesc] = useState(species.description ?? "");
  const [imageUrl, setImageUrl] = useState(species.image_url ?? "");
  const [spacingCm, setSpacingCm] = useState<number | string>(species.spacing_cm ?? "");
  const [germMin, setGermMin] = useState<number | string>(species.days_to_germination_min ?? "");
  const [germMax, setGermMax] = useState<number | string>(species.days_to_germination_max ?? "");
  const [harvestMin, setHarvestMin] = useState<number | string>(species.days_to_harvest_min ?? "");
  const [harvestMax, setHarvestMax] = useState<number | string>(species.days_to_harvest_max ?? "");

  const handleSave = () => {
    onSave({
      common_name: commonName || null,
      scientific_name: scientificName || null,
      family: family || null,
      genus: genus || null,
      growth_type: growthType || null,
      sun_requirement: sunReq || null,
      water_requirement: waterReq || null,
      description: desc || null,
      image_url: imageUrl || null,
      spacing_cm: spacingCm !== "" ? Number(spacingCm) : null,
      days_to_germination_min: germMin !== "" ? Number(germMin) : null,
      days_to_germination_max: germMax !== "" ? Number(germMax) : null,
      days_to_harvest_min: harvestMin !== "" ? Number(harvestMin) : null,
      days_to_harvest_max: harvestMax !== "" ? Number(harvestMax) : null,
      hardiness_zone_min: null,
      hardiness_zone_max: null,
      soil_ph_min: null,
      soil_ph_max: null,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Edit Species" size="lg">
      <Stack gap="sm">
        <TextInput label="Common name" value={commonName} onChange={(e) => setCommonName(e.currentTarget.value)} required />
        <TextInput label="Scientific name" value={scientificName} onChange={(e) => setScientificName(e.currentTarget.value)} />
        <Group grow>
          <TextInput label="Family" value={family} onChange={(e) => setFamily(e.currentTarget.value)} />
          <TextInput label="Genus" value={genus} onChange={(e) => setGenus(e.currentTarget.value)} />
        </Group>
        <Group grow>
          <Select label="Growth type" data={GROWTH_OPTIONS} value={growthType} onChange={setGrowthType} clearable />
          <Select label="Sun requirement" data={SUN_OPTIONS} value={sunReq} onChange={setSunReq} clearable />
          <Select label="Water requirement" data={WATER_OPTIONS} value={waterReq} onChange={setWaterReq} clearable />
        </Group>
        <TextInput label="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value)} />
        <TextInput label="Description" value={desc} onChange={(e) => setDesc(e.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Spacing (cm)" value={spacingCm} onChange={setSpacingCm} min={0} />
          <NumberInput label="Germination min (days)" value={germMin} onChange={setGermMin} min={0} />
          <NumberInput label="Germination max (days)" value={germMax} onChange={setGermMax} min={0} />
        </Group>
        <Group grow>
          <NumberInput label="Harvest min (days)" value={harvestMin} onChange={setHarvestMin} min={0} />
          <NumberInput label="Harvest max (days)" value={harvestMax} onChange={setHarvestMax} min={0} />
        </Group>
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
