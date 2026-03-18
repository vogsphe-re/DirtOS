import { createFileRoute } from "@tanstack/react-router";
import { GardenPage } from "../features/garden/GardenPage";

export const Route = createFileRoute("/garden/$locationId")(
  { component: GardenLocationPage },
);

function GardenLocationPage() {
  const { locationId } = Route.useParams();
  return <GardenPage locationId={locationId} />;
}
