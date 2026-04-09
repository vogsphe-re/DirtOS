import {
  Button,
  Group,
  Modal,
  Radio,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  commands,
  type Location,
  type SeedlingTray,
  type SeedlingTrayCell,
  type UpdatePlant,
} from "../../lib/bindings";
import type { Plant } from "./types";

type DestinationKind = "plot" | "tray";

interface TrayCellChoice {
  key: string;
  trayId: number;
  row: number;
  col: number;
  locationId: number | null;
  label: string;
  isCurrent: boolean;
}

interface TrayCellCollection {
  tray: SeedlingTray;
  cells: SeedlingTrayCell[];
}

interface TransplantAssignmentModalProps {
  opened: boolean;
  environmentId: number | null;
  plant: Plant | null;
  onClose: () => void;
}

function buildLocationPatch(locationId: number | null): UpdatePlant {
  return {
    species_id: null,
    location_id: locationId,
    status: null,
    name: null,
    label: null,
    planted_date: null,
    germinated_date: null,
    transplanted_date: null,
    removed_date: null,
    parent_plant_id: null,
    seed_lot_id: null,
    purchase_source: null,
    purchase_date: null,
    purchase_price: null,
    is_harvestable: null,
    lifecycle_override: null,
    notes: null,
  };
}

function isOccupyingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized !== "removed" && normalized !== "dead" && normalized !== "harvested";
}

export function TransplantAssignmentModal({
  opened,
  environmentId,
  plant,
  onClose,
}: TransplantAssignmentModalProps) {
  const queryClient = useQueryClient();

  const [destinationKind, setDestinationKind] = useState<DestinationKind>("plot");
  const [preferredPlotId, setPreferredPlotId] = useState<string | null>(null);
  const [preferredTrayKey, setPreferredTrayKey] = useState<string | null>(null);

  const { data: allPlants = [] } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
    enabled: opened && environmentId != null,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", environmentId],
    queryFn: async () => {
      const res = await commands.listLocations(environmentId!);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Location[];
    },
    enabled: opened && environmentId != null,
  });

  const { data: trays = [] } = useQuery({
    queryKey: ["seedling-trays", environmentId],
    queryFn: async () => {
      const res = await commands.listSeedlingTrays(environmentId!);
      if (res.status === "error") throw new Error(res.error);
      return res.data as SeedlingTray[];
    },
    enabled: opened && environmentId != null,
  });

  const trayIdsKey = trays.map((tray) => tray.id).join(",");

  const { data: trayCollections = [] } = useQuery({
    queryKey: ["transplant-tray-cells", environmentId, trayIdsKey],
    queryFn: async () => {
      const collections = await Promise.all(
        trays.map(async (tray): Promise<TrayCellCollection> => {
          const res = await commands.listSeedlingTrayCells(tray.id);
          if (res.status === "error") throw new Error(res.error);
          return { tray, cells: res.data as SeedlingTrayCell[] };
        }),
      );
      return collections;
    },
    enabled: opened && environmentId != null && trays.length > 0,
  });

  const envPlants = useMemo(
    () => allPlants.filter((item) => item.environment_id === environmentId),
    [allPlants, environmentId],
  );

  const availablePlotSpaces = useMemo(() => {
    if (!plant) return [] as Location[];

    const occupiedLocationIds = new Set(
      envPlants
        .filter(
          (item) =>
            item.id !== plant.id
            && item.location_id != null
            && isOccupyingStatus(String(item.status)),
        )
        .map((item) => item.location_id as number),
    );

    return locations
      .filter(
        (location) =>
          location.location_type === "Space"
          && !occupiedLocationIds.has(location.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [envPlants, locations, plant]);

  const availableTrayChoices = useMemo(() => {
    if (!plant) return [] as TrayCellChoice[];

    const choices: TrayCellChoice[] = [];

    for (const { tray, cells } of trayCollections) {
      const occupiedByCell = new Map<string, SeedlingTrayCell>();
      for (const cell of cells) {
        occupiedByCell.set(`${cell.row}:${cell.col}`, cell);
      }

      for (let row = 0; row < tray.rows; row++) {
        for (let col = 0; col < tray.cols; col++) {
          const existing = occupiedByCell.get(`${row}:${col}`);
          const occupantId = existing?.plant_id ?? null;

          if (occupantId != null && occupantId !== plant.id) continue;

          const isCurrent = occupantId === plant.id;
          choices.push({
            key: `${tray.id}:${row}:${col}`,
            trayId: tray.id,
            row,
            col,
            locationId: tray.location_id,
            isCurrent,
            label: `${tray.name} - Row ${row + 1}, Col ${col + 1}${isCurrent ? " (current)" : ""}`,
          });
        }
      }
    }

    return choices.sort((a, b) => a.label.localeCompare(b.label));
  }, [plant, trayCollections]);

  const currentTrayAssignments = useMemo(() => {
    if (!plant) return [] as TrayCellCollection[];

    return trayCollections.flatMap(({ tray, cells }) =>
      cells
        .filter((cell) => cell.plant_id === plant.id)
        .map((cell) => ({ tray, cells: [cell] })),
    );
  }, [plant, trayCollections]);

  const effectiveDestinationKind = useMemo<DestinationKind>(() => {
    if (
      destinationKind === "plot"
      && availablePlotSpaces.length === 0
      && availableTrayChoices.length > 0
    ) {
      return "tray";
    }

    if (
      destinationKind === "tray"
      && availableTrayChoices.length === 0
      && availablePlotSpaces.length > 0
    ) {
      return "plot";
    }

    return destinationKind;
  }, [destinationKind, availablePlotSpaces.length, availableTrayChoices.length]);

  const selectedPlotId = useMemo(() => {
    if (preferredPlotId && availablePlotSpaces.some((space) => String(space.id) === preferredPlotId)) {
      return preferredPlotId;
    }
    return availablePlotSpaces[0] ? String(availablePlotSpaces[0].id) : null;
  }, [preferredPlotId, availablePlotSpaces]);

  const selectedTrayKey = useMemo(() => {
    if (preferredTrayKey && availableTrayChoices.some((choice) => choice.key === preferredTrayKey)) {
      return preferredTrayKey;
    }

    const currentChoice = availableTrayChoices.find((choice) => choice.isCurrent);
    if (currentChoice) return currentChoice.key;

    return availableTrayChoices[0]?.key ?? null;
  }, [preferredTrayKey, availableTrayChoices]);

  const transplantMutation = useMutation({
    mutationFn: async () => {
      if (!plant) throw new Error("No plant selected for transplant.");

      const selectedTray = availableTrayChoices.find((choice) => choice.key === selectedTrayKey) ?? null;

      if (effectiveDestinationKind === "plot" && !selectedPlotId) {
        throw new Error("Choose a plot space before transplanting.");
      }

      if (effectiveDestinationKind === "tray" && !selectedTray) {
        throw new Error("Choose a tray space before transplanting.");
      }

      const transition = await commands.transitionPlantStatus(plant.id, "active");
      if (transition.status === "error") throw new Error(transition.error);

      if (effectiveDestinationKind === "plot") {
        const locationId = Number(selectedPlotId);
        const updateRes = await commands.updatePlant(plant.id, buildLocationPatch(locationId));
        if (updateRes.status === "error") throw new Error(updateRes.error);
      } else if (selectedTray?.locationId != null) {
        const updateRes = await commands.updatePlant(plant.id, buildLocationPatch(selectedTray.locationId));
        if (updateRes.status === "error") throw new Error(updateRes.error);
      }

      const trayCellsToClear = currentTrayAssignments
        .flatMap(({ tray, cells }) =>
          cells.map((cell) => ({ trayId: tray.id, row: cell.row, col: cell.col })),
        )
        .filter((cell) => {
          if (effectiveDestinationKind !== "tray" || !selectedTray) return true;
          return !(
            cell.trayId === selectedTray.trayId
            && cell.row === selectedTray.row
            && cell.col === selectedTray.col
          );
        });

      for (const cell of trayCellsToClear) {
        const clearRes = await commands.clearSeedlingTrayCell(cell.trayId, cell.row, cell.col);
        if (clearRes.status === "error") throw new Error(clearRes.error);
      }

      if (effectiveDestinationKind === "tray" && selectedTray) {
        const assignRes = await commands.assignSeedlingTrayCell({
          tray_id: selectedTray.trayId,
          row: selectedTray.row,
          col: selectedTray.col,
          plant_id: plant.id,
          notes: null,
        });
        if (assignRes.status === "error") throw new Error(assignRes.error);
      }

      return effectiveDestinationKind;
    },
    onSuccess: (kind) => {
      queryClient.invalidateQueries({ queryKey: ["plants-all"] });
      queryClient.invalidateQueries({ queryKey: ["tray-cells"] });

      notifications.show({
        message:
          kind === "plot"
            ? "Plant transplanted to Active and assigned to a plot space."
            : "Plant transplanted to Active and assigned to a tray space.",
        color: "green",
      });

      onClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Transplant failed", message: err.message, color: "red" });
    },
  });

  const noDestinations = availablePlotSpaces.length === 0 && availableTrayChoices.length === 0;

  const canSubmit =
    !noDestinations
    && (
      (effectiveDestinationKind === "plot" && selectedPlotId != null)
      || (effectiveDestinationKind === "tray" && selectedTrayKey != null)
    );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Transplant and assign destination"
      size="sm"
    >
      <Stack gap="sm">
        <Text size="sm">
          Move <strong>{plant?.name ?? "this seedling"}</strong> to Active and choose where it should be assigned.
        </Text>

        <Radio.Group
          label="Destination type"
          value={effectiveDestinationKind}
          onChange={(value) => setDestinationKind(value as DestinationKind)}
        >
          <Group mt="xs" gap="md">
            <Radio
              value="plot"
              label={`Plot space (${availablePlotSpaces.length} available)`}
              disabled={availablePlotSpaces.length === 0}
            />
            <Radio
              value="tray"
              label={`Tray space (${availableTrayChoices.length} available)`}
              disabled={availableTrayChoices.length === 0}
            />
          </Group>
        </Radio.Group>

        {effectiveDestinationKind === "plot" ? (
          <Select
            label="Available plot space"
            placeholder="Choose a plot space"
            data={availablePlotSpaces.map((space) => ({
              value: String(space.id),
              label: space.label ? `${space.name} (${space.label})` : space.name,
            }))}
            value={selectedPlotId}
            onChange={setPreferredPlotId}
            searchable
            disabled={availablePlotSpaces.length === 0}
          />
        ) : (
          <Select
            label="Available tray space"
            placeholder="Choose a tray cell"
            data={availableTrayChoices.map((choice) => ({
              value: choice.key,
              label: choice.label,
            }))}
            value={selectedTrayKey}
            onChange={setPreferredTrayKey}
            searchable
            disabled={availableTrayChoices.length === 0}
          />
        )}

        {noDestinations && (
          <Text size="xs" c="red">
            No available plot spaces or tray spaces were found in this environment.
          </Text>
        )}

        <Text size="xs" c="dimmed">
          Transplant sets today's transplant date and updates the seedling to Active status.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="blue"
            size="xs"
            loading={transplantMutation.isPending}
            onClick={() => transplantMutation.mutate()}
            disabled={!canSubmit}
          >
            Transplant
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
