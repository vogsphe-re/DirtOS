import { createFileRoute } from "@tanstack/react-router";
import { OutdoorPlotManager } from "../features/garden/OutdoorPlotManager";

export const Route = createFileRoute("/garden/plots")({
  component: OutdoorPlotManager,
});