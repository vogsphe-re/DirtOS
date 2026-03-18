import { createFileRoute } from "@tanstack/react-router";
import { SeedlingPlanner } from "../features/plants/SeedlingPlanner";

export const Route = createFileRoute("/plants/seedlings")({
  component: SeedlingPlanner,
});
