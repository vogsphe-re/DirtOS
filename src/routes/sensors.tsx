import { createFileRoute } from "@tanstack/react-router";
import { SensorDashboard } from "../features/sensors/SensorDashboard";

export const Route = createFileRoute("/sensors")({
  component: SensorDashboard,
});

