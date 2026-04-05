import { createFileRoute } from "@tanstack/react-router";
import { BarcodeLabelPrintPage } from "../features/inventory/BarcodeLabelPrintPage";

export const Route = createFileRoute("/labels")({
  component: BarcodeLabelPrintPage,
});
