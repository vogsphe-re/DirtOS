import { createFileRoute } from "@tanstack/react-router";
import { PlantDetail } from "../features/plants/PlantDetail";

export const Route = createFileRoute("/plants/individuals/$plantId")({
  component: PlantDetailPage,
});

function PlantDetailPage() {
  const { plantId } = Route.useParams();
  return <PlantDetail plantId={Number(plantId)} />;
}
