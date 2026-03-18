import { createFileRoute } from "@tanstack/react-router";
import { SpeciesDetail } from "../features/plants/SpeciesDetail";

export const Route = createFileRoute("/plants/$speciesId")({
  component: SpeciesDetailPage,
});

function SpeciesDetailPage() {
  const { speciesId } = Route.useParams();
  return <SpeciesDetail speciesId={Number(speciesId)} />;
}
