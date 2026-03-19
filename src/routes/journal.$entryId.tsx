import { createFileRoute } from "@tanstack/react-router";
import { JournalEntryDetail } from "../features/journal/JournalEntry";

export const Route = createFileRoute("/journal/$entryId")({
  component: JournalEntryRoute,
});

function JournalEntryRoute() {
  const { entryId } = Route.useParams();
  return <JournalEntryDetail entryId={Number(entryId)} />;
}
