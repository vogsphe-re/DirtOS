import { createFileRoute } from "@tanstack/react-router";
import { GardenPage } from "../features/garden/GardenPage";

export const Route = createFileRoute("/garden/")(
  { component: GardenPage },
);
