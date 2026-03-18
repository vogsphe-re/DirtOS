import { createFileRoute } from "@tanstack/react-router";
import { SpeciesCatalog } from "../features/plants/SpeciesCatalog";

export const Route = createFileRoute("/plants/")({
  component: SpeciesCatalog,
});
