import {
  Anchor,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowDown, IconSeedling } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { commands } from "../../lib/bindings";
import type { Plant, SeedLot } from "../../lib/bindings";

interface GenealogyViewProps {
  plant: Plant;
}

export function GenealogyView({ plant }: GenealogyViewProps) {
  const navigate = useNavigate();

  // ── Parent plant ───────────────────────────────────────────────────────────
  const { data: parentPlant } = useQuery<Plant | null>({
    queryKey: ["plant", plant.parent_plant_id],
    queryFn: async () => {
      const res = await commands.getPlant(plant.parent_plant_id!);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant | null;
    },
    enabled: plant.parent_plant_id != null,
  });

  // ── Seed lot origin ────────────────────────────────────────────────────────
  const { data: seedLot } = useQuery<SeedLot | null>({
    queryKey: ["seed-lot", plant.seed_lot_id],
    queryFn: async () => {
      const res = await commands.getSeedLot(plant.seed_lot_id!);
      if (res.status === "error") throw new Error(res.error);
      return res.data as SeedLot | null;
    },
    enabled: plant.seed_lot_id != null,
  });

  // ── Offspring plants (plants where parent_plant_id === plant.id) ───────────
  const { data: allPlants = [], isLoading: loadingOffspring } = useQuery<Plant[]>({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
  });

  const offspring = allPlants.filter((p) => p.parent_plant_id === plant.id);

  const noLineage =
    plant.parent_plant_id == null &&
    plant.seed_lot_id == null &&
    offspring.length === 0;

  if (noLineage) {
    return (
      <Stack align="center" py="xl" gap="xs">
        <IconSeedling size={32} color="var(--mantine-color-green-6)" />
        <Text c="dimmed">No genealogy data linked to this plant yet.</Text>
        <Text size="xs" c="dimmed">
          Edit the plant to set a parent plant ID or seed lot ID to start building the family tree.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={5}>Plant Lineage</Title>

      {/* ── Parent ──────────────────────────────────────────────────────── */}
      {plant.parent_plant_id != null && (
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed" fw={500} mb={4}>Parent plant</Text>
          {parentPlant ? (
            <Anchor
              size="sm"
              fw={600}
              onClick={() =>
                navigate({
                  to: "/plants/individuals/$plantId",
                  params: { plantId: String(parentPlant.id) },
                })
              }
            >
              {parentPlant.name}
            </Anchor>
          ) : (
            <Text size="sm" c="dimmed">Plant #{plant.parent_plant_id}</Text>
          )}
        </Card>
      )}

      {/* ── Seed lot ────────────────────────────────────────────────────── */}
      {plant.seed_lot_id != null && (
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed" fw={500} mb={4}>Grown from seed lot</Text>
          {seedLot ? (
            <Stack gap={2}>
              <Text size="sm" fw={600}>{seedLot.asset_id ?? seedLot.lot_label ?? `Lot #${seedLot.id}`}</Text>
              {seedLot.collected_date && (
                <Text size="xs" c="dimmed">Collected: {seedLot.collected_date}</Text>
              )}
              {seedLot.viability_pct != null && (
                <Text size="xs" c="dimmed">Viability: {seedLot.viability_pct}%</Text>
              )}
              {seedLot.storage_location && (
                <Text size="xs" c="dimmed">Storage: {seedLot.storage_location}</Text>
              )}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Seed lot #{plant.seed_lot_id}</Text>
          )}
        </Card>
      )}

      {/* ── This plant (center node) ─────────────────────────────────────── */}
      {(plant.parent_plant_id != null || plant.seed_lot_id != null) && offspring.length > 0 && (
        <Center>
          <IconArrowDown size={20} color="var(--mantine-color-dimmed)" />
        </Center>
      )}

      <Card withBorder p="sm" bg="var(--mantine-color-green-light)">
        <Group gap="xs">
          <IconSeedling size={16} />
          <Text size="sm" fw={700}>{plant.name} (this plant)</Text>
          <Badge size="xs" variant="light" color="green-outline">{plant.status}</Badge>
        </Group>
      </Card>

      {/* ── Offspring ────────────────────────────────────────────────────── */}
      {loadingOffspring && <Loader size="xs" />}
      {offspring.length > 0 && (
        <>
          <Center>
            <IconArrowDown size={20} color="var(--mantine-color-dimmed)" />
          </Center>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed" fw={500} mb="xs">
              Offspring ({offspring.length})
            </Text>
            <Stack gap="xs">
              {offspring.map((child) => (
                <Group key={child.id} justify="space-between">
                  <Anchor
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: "/plants/individuals/$plantId",
                        params: { plantId: String(child.id) },
                      })
                    }
                  >
                    {child.name}
                  </Anchor>
                  <Badge size="xs" variant="light" color="gray">
                    {child.status}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}
