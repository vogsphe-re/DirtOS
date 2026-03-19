import { Alert, Button, Card, Group, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { commands, type GrowMethod, type IndoorEnvironmentSummary } from "../../lib/bindings";

const GROW_METHOD_OPTIONS: { value: GrowMethod; label: string }[] = [
  { value: "Soil", label: "Soil" },
  { value: "HydroponicDwc", label: "Hydroponic DWC" },
  { value: "HydroponicNft", label: "Hydroponic NFT" },
  { value: "HydroponicEbbFlow", label: "Hydroponic Ebb & Flow" },
  { value: "HydroponicDrip", label: "Hydroponic Drip" },
  { value: "Aeroponic", label: "Aeroponic" },
  { value: "Aquaponic", label: "Aquaponic" },
];

type Props = {
  environmentId: number;
  onCreated: (value: IndoorEnvironmentSummary) => void;
};

export function IndoorSetup({ environmentId, onCreated }: Props) {
  const [name, setName] = useState("Indoor Tent");
  const [label, setLabel] = useState<string | null>("grow");
  const [growMethod, setGrowMethod] = useState<GrowMethod | null>("HydroponicDwc");
  const [lightType, setLightType] = useState<string | null>("LED");
  const [lightWattage, setLightWattage] = useState<number | string>(320);
  const [tentWidth, setTentWidth] = useState<number | string>(120);
  const [tentDepth, setTentDepth] = useState<number | string>(120);
  const [tentHeight, setTentHeight] = useState<number | string>(200);
  const [reservoirLiters, setReservoirLiters] = useState<number | string>(80);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.createIndoorEnvironment({
        environment_id: environmentId,
        parent_id: null,
        name,
        label,
        notes: null,
        tent_width: typeof tentWidth === "number" ? tentWidth : null,
        tent_depth: typeof tentDepth === "number" ? tentDepth : null,
        tent_height: typeof tentHeight === "number" ? tentHeight : null,
        grow_method: growMethod,
        light_type: lightType,
        light_wattage: typeof lightWattage === "number" ? lightWattage : null,
        light_schedule_on: "06:00",
        light_schedule_off: "22:00",
        ventilation_type: "inline-fan",
        ventilation_cfm: 240,
        reservoir_capacity_liters:
          typeof reservoirLiters === "number" ? reservoirLiters : null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: (value) => onCreated(value),
  });

  return (
    <Card withBorder radius="md" p="md">
      <Stack>
        <Group grow>
          <TextInput
            label="Indoor Name"
            placeholder="Main Tent"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Label"
            placeholder="flower-room"
            value={label ?? ""}
            onChange={(e) => setLabel(e.currentTarget.value || null)}
          />
        </Group>
        <Group grow>
          <Select
            label="Grow Method"
            data={GROW_METHOD_OPTIONS}
            value={growMethod}
            onChange={(v) => setGrowMethod((v as GrowMethod | null) ?? null)}
          />
          <TextInput
            label="Light Type"
            placeholder="LED"
            value={lightType ?? ""}
            onChange={(e) => setLightType(e.currentTarget.value || null)}
          />
          <NumberInput
            label="Light Wattage"
            value={lightWattage}
            onChange={setLightWattage}
            min={1}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Tent Width (cm)"
            value={tentWidth}
            onChange={setTentWidth}
            min={20}
          />
          <NumberInput
            label="Tent Depth (cm)"
            value={tentDepth}
            onChange={setTentDepth}
            min={20}
          />
          <NumberInput
            label="Tent Height (cm)"
            value={tentHeight}
            onChange={setTentHeight}
            min={40}
          />
          <NumberInput
            label="Reservoir (L)"
            value={reservoirLiters}
            onChange={setReservoirLiters}
            min={1}
          />
        </Group>

        {createMutation.isError && (
          <Alert color="red" title="Setup failed">
            {String(createMutation.error)}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Indoor Environment
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
