import {
  Badge,
  Button,
  Group,
  Image,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconPlus,
  IconSearch,
  IconSun,
  IconDroplet,
  IconPlant,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { AddSpeciesModal } from "./AddSpeciesModal";
import type { Species } from "./types";

const SUN_OPTIONS = [
  { value: "", label: "Any sun" },
  { value: "full_sun", label: "Full sun" },
  { value: "partial_sun", label: "Partial sun" },
  { value: "shade", label: "Shade" },
];

const WATER_OPTIONS = [
  { value: "", label: "Any water" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const GROWTH_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "annual", label: "Annual" },
  { value: "perennial", label: "Perennial" },
  { value: "biennial", label: "Biennial" },
  { value: "tree", label: "Tree" },
  { value: "shrub", label: "Shrub" },
  { value: "vine", label: "Vine" },
  { value: "herb", label: "Herb" },
];

const PAGE_SIZE = 50;

export function SpeciesCatalog() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sun, setSun] = useState<string | null>(null);
  const [water, setWater] = useState<string | null>(null);
  const [growth, setGrowth] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const [debouncedSearch] = useDebouncedValue(search, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["species", debouncedSearch, sun, water, growth, page],
    queryFn: async () => {
      const res = await (commands as any).listSpecies(
        debouncedSearch || null,
        sun || null,
        water || null,
        growth || null,
        PAGE_SIZE,
        (page - 1) * PAGE_SIZE,
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data as Species[];
    },
  });

  const species = data ?? [];
  const rows = species.map((sp) => (
    <Table.Tr
      key={sp.id}
      style={{ cursor: "pointer" }}
      onClick={() => navigate({ to: "/plants/$speciesId", params: { speciesId: String(sp.id) } })}
    >
      <Table.Td w={48}>
        {sp.image_url ? (
          <Image src={sp.image_url} w={36} h={36} radius="sm" fit="cover" />
        ) : (
          <IconPlant size={36} stroke={1} />
        )}
      </Table.Td>
      <Table.Td>
        <Text fw={500}>{sp.common_name}</Text>
        {sp.scientific_name && (
          <Text size="xs" c="dimmed" fs="italic">
            {sp.scientific_name}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {sp.family ?? "—"}
        </Text>
      </Table.Td>
      <Table.Td>
        {sp.sun_requirement ? (
          <Badge variant="light" color="yellow" size="sm">
            {sp.sun_requirement.replace("_", " ")}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        {sp.water_requirement ? (
          <Badge variant="light" color="blue" size="sm">
            {sp.water_requirement}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        {sp.days_to_harvest_min != null ? (
          <Text size="sm">
            {sp.days_to_harvest_min}
            {sp.days_to_harvest_max && sp.days_to_harvest_max !== sp.days_to_harvest_min
              ? `–${sp.days_to_harvest_max}`
              : ""}{" "}
            d
          </Text>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Species Catalog</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setAddOpen(true)}
        >
          Add Species
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="sm">
        <TextInput
          placeholder="Search by name…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Sun"
          leftSection={<IconSun size={14} />}
          data={SUN_OPTIONS}
          value={sun ?? ""}
          onChange={(v) => { setSun(v || null); setPage(1); }}
          w={140}
          clearable
        />
        <Select
          placeholder="Water"
          leftSection={<IconDroplet size={14} />}
          data={WATER_OPTIONS}
          value={water ?? ""}
          onChange={(v) => { setWater(v || null); setPage(1); }}
          w={140}
          clearable
        />
        <Select
          placeholder="Growth type"
          data={GROWTH_OPTIONS}
          value={growth ?? ""}
          onChange={(v) => { setGrowth(v || null); setPage(1); }}
          w={150}
          clearable
        />
      </Group>

      {isError && (
        <Text c="red">Failed to load species. Check the console for details.</Text>
      )}

      <Table highlightOnHover withTableBorder withColumnBorders={false} verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={48} />
            <Table.Th>Name</Table.Th>
            <Table.Th>Family</Table.Th>
            <Table.Th>Sun</Table.Th>
            <Table.Th>Water</Table.Th>
            <Table.Th>Days to harvest</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="lg">Loading…</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="lg">No species found.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows
          )}
        </Table.Tbody>
      </Table>

      {species.length === PAGE_SIZE && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={page + 1} />
        </Group>
      )}

      <AddSpeciesModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(sp) => {
          setAddOpen(false);
          refetch();
          navigate({ to: "/plants/$speciesId", params: { speciesId: String(sp.id) } });
        }}
      />
    </Stack>
  );
}
