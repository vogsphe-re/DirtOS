import { createFileRoute } from "@tanstack/react-router";
import { IssueDetail } from "../features/issues/IssueDetail";

export const Route = createFileRoute("/issues/$issueId")({  
  component: IssueDetailRoute,
});

function IssueDetailRoute() {
  const { issueId } = Route.useParams();
  return <IssueDetail issueId={Number(issueId)} />;
}
