import { createFileRoute } from "@tanstack/react-router";
import { SeedlingTrayManager } from "../features/plants/SeedlingTrayManager";

export const Route = createFileRoute("/plants/trays")({
  component: SeedlingTrayManager,
});
