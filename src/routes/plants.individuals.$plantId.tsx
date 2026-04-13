import { createFileRoute } from "@tanstack/react-router";
import { PlantDetail } from "../features/plants/PlantDetail";

export const Route = createFileRoute("/plants/individuals/$plantId")({
  component: PlantDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
});

function PlantDetailPage() {
  const { plantId } = Route.useParams();
  const { from } = Route.useSearch();
  return <PlantDetail plantId={Number(plantId)} from={from} />;
}
