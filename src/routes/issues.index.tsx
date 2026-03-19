import { createFileRoute } from "@tanstack/react-router";
import { IssueList } from "../features/issues/IssueList";

export const Route = createFileRoute("/issues/")({  
  component: IssueList,
});
