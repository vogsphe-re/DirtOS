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
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBrandWikipedia,
  IconExternalLink,
  IconGlobe,
  IconLeaf,
  IconPlant,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { WikiSearchResult, EolSearchResult, GbifSearchResult, TrefleSearchResult } from "../../lib/bindings";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
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

  const enrichInat = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).enrichSpeciesInaturalist(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Enriched", message: "iNaturalist data applied.", color: "green" });
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
        // Single result — enrich immediately without prompting
        enrichWikiBySlug.mutate(candidates[0].slug);
      } else {
        setWikiCandidates(candidates);
        setWikiPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Wikipedia search error", message: err.message, color: "red" }),
  });

  const enrichWikiBySlug = useMutation({
    mutationFn: async (slug: string) => {
      const res = await commands.enrichSpeciesWikipediaBySlug(speciesId, slug);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setWikiPickerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Enriched", message: "Wikipedia description applied.", color: "green" });
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
        enrichEolById.mutate(candidates[0].id);
      } else {
        setEolCandidates(candidates);
        setEolPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "EoL search error", message: err.message, color: "red" }),
  });

  const enrichEolById = useMutation({
    mutationFn: async (eolPageId: number) => {
      const res = await commands.enrichSpeciesEolById(speciesId, eolPageId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setEolPickerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Enriched", message: "Encyclopedia of Life data applied.", color: "teal" });
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
        enrichGbifByKey.mutate(candidates[0].key);
      } else {
        setGbifCandidates(candidates);
        setGbifPickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "GBIF search error", message: err.message, color: "red" }),
  });

  const enrichGbifByKey = useMutation({
    mutationFn: async (gbifKey: number) => {
      const res = await commands.enrichSpeciesGbifByKey(speciesId, gbifKey);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setGbifPickerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Enriched", message: "GBIF biodiversity data applied.", color: "grape" });
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
        enrichTrefleById.mutate(candidates[0].id);
      } else {
        setTrefleCandidates(candidates);
        setTreflePickerOpen(true);
      }
    },
    onError: (err: Error) =>
      notifications.show({ title: "Trefle search error", message: err.message, color: "red" }),
  });

  const enrichTrefleById = useMutation({
    mutationFn: async (trefleId: number) => {
      const res = await commands.enrichSpeciesTrefleById(speciesId, trefleId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setTreflePickerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["species", speciesId] });
      queryClient.invalidateQueries({ queryKey: ["species"] });
      notifications.show({ title: "Enriched", message: "Trefle plant data applied.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Trefle error", message: err.message, color: "red" }),
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
      <Group>
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
              loading={searchWikiCandidates.isPending || enrichWikiBySlug.isPending}
              onClick={() => searchWikiCandidates.mutate()}
            >
              Enrich from Wikipedia
            </Button>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconPlant size={14} />}
              loading={searchEolCandidates.isPending || enrichEolById.isPending}
              onClick={() => searchEolCandidates.mutate()}
            >
              Enrich from EoL
            </Button>
            <Button
              size="xs"
              variant="light"
              color="grape"
              leftSection={<IconGlobe size={14} />}
              loading={searchGbifCandidates.isPending || enrichGbifByKey.isPending}
              onClick={() => searchGbifCandidates.mutate()}
            >
              Enrich from GBIF
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconLeaf size={14} />}
              loading={searchTrefleCandidates.isPending || enrichTrefleById.isPending}
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
                  loading={enrichWikiBySlug.isPending && enrichWikiBySlug.variables === c.slug}
                  onClick={() => enrichWikiBySlug.mutate(c.slug)}
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
                  loading={enrichEolById.isPending && enrichEolById.variables === c.id}
                  onClick={() => enrichEolById.mutate(c.id)}
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
                  loading={enrichGbifByKey.isPending && enrichGbifByKey.variables === c.key}
                  onClick={() => enrichGbifByKey.mutate(c.key)}
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
                  loading={enrichTrefleById.isPending && enrichTrefleById.variables === c.id}
                  onClick={() => enrichTrefleById.mutate(c.id)}
                >
                  Use this
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>
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
