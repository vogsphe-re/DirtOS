import {
  Badge,
  Button,
  Group,
  Loader,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { commands } from "../../lib/bindings";
import type { Issue, IssueLabel } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { IssueForm } from "./IssueForm";
import {
  ISSUE_PRIORITY_COLORS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from "./types";
import type { IssueStatus, IssuePriority } from "./types";

export function IssueList() {
  const navigate = useNavigate();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const [createOpen, setCreateOpen] = useState(false);

  // Filter state
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "">("");
  const [labelFilter, setLabelFilter] = useState<string[]>([]);

  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ["issues", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listIssues(activeEnvId, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const { data: allLabels = [] } = useQuery<IssueLabel[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await commands.listLabels();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  // Load labels for each issue (map issueId → label ids)
  const { data: issueLabelMap = {} } = useQuery<Record<number, number[]>>({
    queryKey: ["issues-labels-map", issues.map((i) => i.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        issues.map(async (issue) => {
          const res = await commands.listIssueLabels(issue.id);
          const ids = res.status === "ok" ? res.data.map((l) => l.id) : [];
          return [issue.id, ids] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: issues.length > 0,
  });

  const labelById = useMemo(() => {
    const m: Record<number, IssueLabel> = {};
    for (const l of allLabels) m[l.id] = l;
    return m;
  }, [allLabels]);

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (titleFilter && !issue.title.toLowerCase().includes(titleFilter.toLowerCase()))
        return false;
      if (statusFilter && issue.status !== statusFilter) return false;
      if (priorityFilter && issue.priority !== priorityFilter) return false;
      if (labelFilter.length > 0) {
        const issueLabels = issueLabelMap[issue.id] ?? [];
        const hasAll = labelFilter.every((lId) => issueLabels.includes(Number(lId)));
        if (!hasAll) return false;
      }
      return true;
    });
  }, [issues, titleFilter, statusFilter, priorityFilter, labelFilter, issueLabelMap]);

  const labelSelectOptions = allLabels.map((l) => ({
    value: String(l.id),
    label: l.name,
  }));

  const rows = filtered.map((issue) => {
    const issueLabels = (issueLabelMap[issue.id] ?? []).map((id) => labelById[id]).filter(Boolean);
    return (
      <Table.Tr
        key={issue.id}
        style={{ cursor: "pointer" }}
        onClick={() =>
          navigate({ to: "/issues/$issueId", params: { issueId: String(issue.id) } })
        }
      >
        <Table.Td>
          <Text size="xs" c="dimmed">#{issue.id}</Text>
        </Table.Td>
        <Table.Td>
          <Text fw={500} lineClamp={1}>{issue.title}</Text>
        </Table.Td>
        <Table.Td>
          <Badge color={ISSUE_STATUS_COLORS[issue.status]} variant="light" size="sm">
            {ISSUE_STATUS_LABELS[issue.status]}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Badge color={ISSUE_PRIORITY_COLORS[issue.priority]} variant="dot" size="sm">
            {ISSUE_PRIORITY_LABELS[issue.priority]}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap={4}>
            {issueLabels.slice(0, 3).map((l) => (
              <Badge key={l.id} color={l.color ?? "gray"} variant="filled" size="xs">
                {l.name}
              </Badge>
            ))}
            {issueLabels.length > 3 && (
              <Text size="xs" c="dimmed">+{issueLabels.length - 3}</Text>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {new Date(issue.created_at).toLocaleDateString()}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {new Date(issue.updated_at).toLocaleDateString()}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Issues</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Issue
        </Button>
      </Group>

      {/* Filter bar */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search title…"
          leftSection={<IconSearch size={14} />}
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.currentTarget.value)}
          style={{ flex: "1 1 160px", minWidth: 160 }}
        />
        <Select
          placeholder="Status"
          data={[{ value: "", label: "All Statuses" }, ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={(v) => setStatusFilter((v ?? "") as IssueStatus | "")}
          clearable
          style={{ minWidth: 140 }}
        />
        <Select
          placeholder="Priority"
          data={[{ value: "", label: "All Priorities" }, ...PRIORITY_OPTIONS]}
          value={priorityFilter}
          onChange={(v) => setPriorityFilter((v ?? "") as IssuePriority | "")}
          clearable
          style={{ minWidth: 140 }}
        />
        <MultiSelect
          placeholder="Labels"
          data={labelSelectOptions}
          value={labelFilter}
          onChange={setLabelFilter}
          searchable
          clearable
          style={{ minWidth: 180 }}
        />
      </Group>

      {isLoading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Labels</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Updated</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length > 0 ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center" py="md">
                    {issues.length === 0 ? "No issues yet." : "No issues match the current filters."}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      {!activeEnvId && (
        <Text c="dimmed" ta="center">
          Select an environment to view issues.
        </Text>
      )}

      <IssueForm
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Stack>
  );
}
