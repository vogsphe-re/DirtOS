import { Tabs } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { PlantsList } from "../features/plants/PlantsList";
import { SpeciesCatalog } from "../features/plants/SpeciesCatalog";

export const Route = createFileRoute("/plants/")({
  component: PlantsLanding,
});

function PlantsLanding() {
  return (
    <Tabs defaultValue="individuals" keepMounted={false}>
      <Tabs.List px="md" pt="md">
        <Tabs.Tab value="individuals">Active Plants</Tabs.Tab>
        <Tabs.Tab value="species">Species Database</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="individuals">
        <PlantsList defaultStatusFilter="active" />
      </Tabs.Panel>

      <Tabs.Panel value="species">
        <SpeciesCatalog />
      </Tabs.Panel>
    </Tabs>
  );
}
