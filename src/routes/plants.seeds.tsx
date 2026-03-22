import { createFileRoute } from "@tanstack/react-router";
import SeedStoreManager from "../features/plants/SeedStoreManager";

export const Route = createFileRoute("/plants/seeds")({
  component: SeedStoreManager,
});
