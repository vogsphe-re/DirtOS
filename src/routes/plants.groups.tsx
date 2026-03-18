import { createFileRoute } from "@tanstack/react-router";
import { PlantGroups } from "../features/plants/PlantGroups";

export const Route = createFileRoute("/plants/groups")({
  component: PlantGroups,
});
