import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPackage,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSeeding,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  commands,
  type SeedLot,
  type NewSeedLot,
  type UpdateSeedLot,
  type SowSeedInput,
  type SeedlingTray,
  type SeedlingTrayCell,
} from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Species } from "./types";

const SOURCE_TYPES = [
  { value: "purchased", label: "Purchased" },
  { value: "harvested", label: "Harvested" },
  { value: "traded", label: "Traded" },
  { value: "gifted", label: "Gifted" },
];

// ---------------------------------------------------------------------------
// Create / edit seed lot modal
// ---------------------------------------------------------------------------

interface SeedFormModalProps {
  opened: boolean;
  onClose: () => void;
  seedLot?: SeedLot | null;
  speciesList: Species[];
}

function SeedFormModal({ opened, onClose, seedLot, speciesList }: SeedFormModalProps) {
  const queryClient = useQueryClient();

  const [speciesId, setSpeciesId] = useState<string | null>(
    seedLot?.species_id?.toString() ?? null,
  );
  const [lotLabel, setLotLabel] = useState(seedLot?.lot_label ?? "");
  const [quantity, setQuantity] = useState<number | string>(seedLot?.quantity ?? "");
  const [viabilityPct, setViabilityPct] = useState<number | string>(
    seedLot?.viability_pct ?? "",
  );
  const [storageLocation, setStorageLocation] = useState(
    seedLot?.storage_location ?? "",
  );
  const [sourceType, setSourceType] = useState<string | null>(
    seedLot?.source_type ?? "purchased",
  );
  const [vendor, setVendor] = useState(seedLot?.vendor ?? "");
  const [purchaseDate, setPurchaseDate] = useState(seedLot?.purchase_date ?? "");
  const [expirationDate, setExpirationDate] = useState(seedLot?.expiration_date ?? "");
  const [packetInfo, setPacketInfo] = useState(seedLot?.packet_info ?? "");
  const [notes, setNotes] = useState(seedLot?.notes ?? "");

  const createMut = useMutation({
    mutationFn: (input: NewSeedLot) => commands.createSeedStoreItem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seed-store"] });
      notifications.show({ title: "Seed lot created", message: "", color: "green" });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSeedLot }) =>
      commands.updateSeedStoreItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seed-store"] });
      notifications.show({ title: "Seed lot updated", message: "", color: "blue" });
      onClose();
    },
  });

  const handleSubmit = () => {
    const sid = speciesId ? Number(speciesId) : null;
    const qty = typeof quantity === "number" ? quantity : null;
    const viab = typeof viabilityPct === "number" ? viabilityPct : null;

    if (seedLot) {
      updateMut.mutate({
        id: seedLot.id,
        input: {
          species_id: sid,
          lot_label: lotLabel || null,
          quantity: qty,
          viability_pct: viab,
          storage_location: storageLocation || null,
          collected_date: null,
          source_type: sourceType,
          vendor: vendor || null,
          purchase_date: purchaseDate || null,
          expiration_date: expirationDate || null,
          packet_info: packetInfo || null,
          notes: notes || null,
        },
      });
    } else {
      createMut.mutate({
        species_id: sid,
        parent_plant_id: null,
        harvest_id: null,
        lot_label: lotLabel || null,
        quantity: qty,
        viability_pct: viab,
        storage_location: storageLocation || null,
        collected_date: null,
        source_type: sourceType,
        vendor: vendor || null,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        packet_info: packetInfo || null,
        notes: notes || null,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={seedLot ? "Edit Seed Lot" : "Add Seed Lot"}
      size="lg"
    >
      <Stack gap="sm">
        <Select
          label="Species"
          placeholder="Select species"
          data={speciesList.map((s) => ({
            value: s.id.toString(),
            label: s.common_name,
          }))}
          value={speciesId}
          onChange={setSpeciesId}
          searchable
          clearable
        />
        <TextInput
          label="Lot Label"
          placeholder="e.g. Tomato Roma 2025"
          value={lotLabel}
          onChange={(e) => setLotLabel(e.currentTarget.value)}
        />
        <Group grow>
          <NumberInput
            label="Quantity"
            placeholder="Seeds count"
            min={0}
            value={quantity}
            onChange={setQuantity}
          />
          <NumberInput
            label="Viability %"
            placeholder="e.g. 85"
            min={0}
            max={100}
            value={viabilityPct}
            onChange={setViabilityPct}
          />
        </Group>
        <Select
          label="Source"
          data={SOURCE_TYPES}
          value={sourceType}
          onChange={setSourceType}
        />
        <TextInput
          label="Vendor"
          placeholder="Seed company or source name"
          value={vendor}
          onChange={(e) => setVendor(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput
            label="Purchase Date"
            placeholder="YYYY-MM-DD"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.currentTarget.value)}
          />
          <TextInput
            label="Expiration Date"
            placeholder="YYYY-MM-DD"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.currentTarget.value)}
          />
        </Group>
        <TextInput
          label="Storage Location"
          placeholder="e.g. Shelf A, Drawer 3"
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.currentTarget.value)}
        />
        <TextInput
          label="Packet Info"
          placeholder="Brand, SKU, etc."
          value={packetInfo}
          onChange={(e) => setPacketInfo(e.currentTarget.value)}
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>
            {seedLot ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sow to tray modal
// ---------------------------------------------------------------------------

interface SowToTrayModalProps {
  opened: boolean;
  onClose: () => void;
  seedLot: SeedLot;
}

function SowToTrayModal({ opened, onClose, seedLot }: SowToTrayModalProps) {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const queryClient = useQueryClient();

  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [plantName, setPlantName] = useState("");

  const { data: traysResult } = useQuery({
    queryKey: ["seedling-trays", activeEnvId],
    queryFn: () => commands.listSeedlingTrays(activeEnvId!),
    enabled: opened && activeEnvId != null,
  });

  const trays: SeedlingTray[] =
    traysResult?.status === "ok" ? traysResult.data : [];

  const selectedTray = trays.find((t) => t.id.toString() === selectedTrayId) ?? null;

  const { data: cellsResult } = useQuery({
    queryKey: ["tray-cells", selectedTrayId],
    queryFn: () => commands.listSeedlingTrayCells(Number(selectedTrayId)),
    enabled: selectedTrayId != null,
  });

  const cells: SeedlingTrayCell[] =
    cellsResult?.status === "ok" ? cellsResult.data : [];

  // Build a set of occupied cells
  const occupiedCells = new Set(cells.map((c) => `${c.row}-${c.col}`));

  const sowMut = useMutation({
    mutationFn: (input: SowSeedInput) => commands.sowSeedToTray(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seed-store"] });
      queryClient.invalidateQueries({ queryKey: ["tray-cells"] });
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      notifications.show({
        title: "Seed sown",
        message: "A seedling has been created and placed in the tray",
        color: "green",
      });
      onClose();
    },
    onError: (e) => {
      notifications.show({
        title: "Sow failed",
        message: String(e),
        color: "red",
      });
    },
  });

  const handleSow = () => {
    if (!selectedTray || !selectedCell) return;
    sowMut.mutate({
      seed_lot_id: seedLot.id,
      tray_id: selectedTray.id,
      row: selectedCell.row,
      col: selectedCell.col,
      plant_name: plantName || null,
      notes: null,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Sow Seed to Tray" size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Sowing from: <strong>{seedLot.lot_label ?? `Lot #${seedLot.id}`}</strong>
          {seedLot.quantity != null && ` (${seedLot.quantity} remaining)`}
        </Text>

        <TextInput
          label="Plant Name (optional)"
          placeholder="Auto-generated if empty"
          value={plantName}
          onChange={(e) => setPlantName(e.currentTarget.value)}
        />

        <Select
          label="Select Tray"
          placeholder="Choose a seedling tray"
          data={trays.map((t) => ({
            value: t.id.toString(),
            label: `${t.name} (${t.rows}×${t.cols})`,
          }))}
          value={selectedTrayId}
          onChange={(v) => {
            setSelectedTrayId(v);
            setSelectedCell(null);
          }}
          searchable
        />

        {selectedTray && (
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Select an empty cell:
            </Text>
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${selectedTray.cols}, 1fr)`,
                gap: 4,
              }}
            >
              {Array.from({ length: selectedTray.rows }, (_, r) =>
                Array.from({ length: selectedTray.cols }, (_, c) => {
                  const key = `${r}-${c}`;
                  const occupied = occupiedCells.has(key);
                  const isSelected =
                    selectedCell?.row === r && selectedCell?.col === c;
                  return (
                    <Box
                      key={key}
                      onClick={() => {
                        if (!occupied) setSelectedCell({ row: r, col: c });
                      }}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        border: isSelected
                          ? "2px solid var(--mantine-color-blue-6)"
                          : "1px solid var(--mantine-color-default-border)",
                        borderRadius: 4,
                        cursor: occupied ? "not-allowed" : "pointer",
                        background: occupied
                          ? "var(--mantine-color-gray-3)"
                          : isSelected
                            ? "var(--mantine-color-blue-1)"
                            : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: occupied ? 0.4 : 1,
                      }}
                    >
                      {occupied && <IconSeeding size={14} />}
                    </Box>
                  );
                }),
              )}
            </Box>
            {selectedCell && (
              <Text size="xs" c="dimmed" mt={4}>
                Selected: Row {selectedCell.row + 1}, Col {selectedCell.col + 1}
              </Text>
            )}
          </Box>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSow}
            loading={sowMut.isPending}
            disabled={!selectedTray || !selectedCell}
          >
            Sow Seed
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Seed store item card
// ---------------------------------------------------------------------------

function SeedStoreCard({
  lot,
  speciesList,
  onEdit,
  onDelete,
  onSow,
}: {
  lot: SeedLot;
  speciesList: Species[];
  onEdit: () => void;
  onDelete: () => void;
  onSow: () => void;
}) {
  const species = speciesList.find((s) => s.id === lot.species_id);
  const qty = lot.quantity ?? 0;
  const lowStock = qty > 0 && qty <= 5;
  const outOfStock = qty <= 0;

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb={4}>
        <Group gap={8}>
          <IconPackage size={18} />
          <Text fw={600} size="sm">
            {lot.lot_label ?? `Lot #${lot.id}`}
          </Text>
        </Group>
        <Group gap={4}>
          <Tooltip label="Sow to tray">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="green-outline"
              onClick={onSow}
              disabled={outOfStock}
            >
              <IconSeeding size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit">
            <ActionIcon size="sm" variant="subtle" onClick={onEdit}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {species && (
        <Text size="xs" c="dimmed">
          {species.common_name}
          {species.scientific_name && ` (${species.scientific_name})`}
        </Text>
      )}

      <Group gap={8} mt={8}>
        <Badge
          size="sm"
          color={outOfStock ? "red" : lowStock ? "yellow" : "green"}
          variant="light"
        >
          {outOfStock ? "Out of stock" : `${qty} seeds`}
        </Badge>
        <Badge size="sm" variant="light">
          {lot.source_type}
        </Badge>
        {lot.viability_pct != null && (
          <Badge size="sm" variant="light" color="grape">
            {lot.viability_pct}% viable
          </Badge>
        )}
      </Group>

      <Stack gap={2} mt={8}>
        {lot.vendor && (
          <Text size="xs" c="dimmed">
            Vendor: {lot.vendor}
          </Text>
        )}
        {lot.storage_location && (
          <Text size="xs" c="dimmed">
            Location: {lot.storage_location}
          </Text>
        )}
        {lot.purchase_date && (
          <Text size="xs" c="dimmed">
            Purchased: {lot.purchase_date}
          </Text>
        )}
        {lot.expiration_date && (
          <Text size="xs" c="dimmed">
            Expires: {lot.expiration_date}
          </Text>
        )}
        {lot.packet_info && (
          <Text size="xs" c="dimmed">
            Packet: {lot.packet_info}
          </Text>
        )}
        {lot.notes && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {lot.notes}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SeedStoreManager() {
  const queryClient = useQueryClient();

  const [formOpened, setFormOpened] = useState(false);
  const [editLot, setEditLot] = useState<SeedLot | null>(null);
  const [sowLot, setSowLot] = useState<SeedLot | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  // Fetch seed store inventory
  const { data: storeResult, isLoading } = useQuery({
    queryKey: ["seed-store"],
    queryFn: () => commands.listSeedStore(null, null),
  });

  const seedLots: SeedLot[] =
    storeResult?.status === "ok" ? storeResult.data : [];

  // Fetch species for display/form
  const { data: speciesResult } = useQuery({
    queryKey: ["species-all"],
    queryFn: () => commands.listSpecies(null, null, null, null, null, null),
  });

  const speciesList: Species[] =
    speciesResult?.status === "ok" ? (speciesResult.data as unknown as Species[]) : [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => commands.deleteSeedStoreItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seed-store"] });
      notifications.show({ title: "Seed lot deleted", message: "", color: "red" });
    },
  });

  // Apply filters
  const filtered = seedLots.filter((lot) => {
    if (filterSource && lot.source_type !== filterSource) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const label = (lot.lot_label ?? "").toLowerCase();
      const vendorStr = (lot.vendor ?? "").toLowerCase();
      const sp = speciesList.find((s) => s.id === lot.species_id);
      const speciesName = (sp?.common_name ?? "").toLowerCase();
      if (!label.includes(q) && !vendorStr.includes(q) && !speciesName.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <ScrollArea h="100%">
      <Stack gap="md" p="md">
        <Group justify="space-between">
          <Title order={3}>
            <Group gap={8}>
              <IconPackage size={24} />
              Seed Store
            </Group>
          </Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditLot(null);
              setFormOpened(true);
            }}
          >
            Add Seeds
          </Button>
        </Group>

        <Group gap="sm">
          <TextInput
            placeholder="Search lots, vendors, species..."
            value={searchText}
            onChange={(e) => setSearchText(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 300 }}
          />
          <Select
            placeholder="All sources"
            data={SOURCE_TYPES}
            value={filterSource}
            onChange={setFilterSource}
            clearable
            w={150}
          />
          <Text size="sm" c="dimmed">
            {filtered.length} lot{filtered.length !== 1 && "s"}
          </Text>
        </Group>

        {isLoading && <Text c="dimmed">Loading seed inventory...</Text>}

        {!isLoading && filtered.length === 0 && (
          <Text c="dimmed">No seed lots found. Add some seeds to get started!</Text>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filtered.map((lot) => (
            <SeedStoreCard
              key={lot.id}
              lot={lot}
              speciesList={speciesList}
              onEdit={() => {
                setEditLot(lot);
                setFormOpened(true);
              }}
              onDelete={() => deleteMut.mutate(lot.id)}
              onSow={() => setSowLot(lot)}
            />
          ))}
        </SimpleGrid>
      </Stack>

      <SeedFormModal
        opened={formOpened}
        onClose={() => {
          setFormOpened(false);
          setEditLot(null);
        }}
        seedLot={editLot}
        speciesList={speciesList}
      />

      {sowLot && (
        <SowToTrayModal
          opened={!!sowLot}
          onClose={() => setSowLot(null)}
          seedLot={sowLot}
        />
      )}
    </ScrollArea>
  );
}
