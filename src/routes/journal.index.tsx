import { createFileRoute } from "@tanstack/react-router";
import { JournalList } from "../features/journal/JournalList";

export const Route = createFileRoute("/journal/")({
  component: JournalList,
});
