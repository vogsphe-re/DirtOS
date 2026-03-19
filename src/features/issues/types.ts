import type { IssueStatus, IssuePriority } from "../../lib/bindings";

export type { IssueStatus, IssuePriority };

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

export const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  new: "gray",
  open: "blue",
  in_progress: "yellow",
  closed: "green",
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ISSUE_PRIORITY_COLORS: Record<IssuePriority, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  critical: "red",
};

export const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

export const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];
