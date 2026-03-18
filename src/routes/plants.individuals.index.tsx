import { createFileRoute } from "@tanstack/react-router";
import { PlantsList } from "../features/plants/PlantsList";

export const Route = createFileRoute("/plants/individuals/")({
  component: PlantsList,
});
