import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Issue, IssueComment, IssueLabel, Plant, Location } from "../../lib/bindings";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./types";
import type { IssueStatus, IssuePriority } from "./types";
import { IssueForm } from "./IssueForm";

interface IssueDetailProps {
  issueId: number;
}

export function IssueDetail({ issueId }: IssueDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const { data: issue, isLoading, isError } = useQuery<Issue | null>({
    queryKey: ["issue", issueId],
    queryFn: async () => {
      const res = await commands.getIssue(issueId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: labels = [] } = useQuery<IssueLabel[]>({
    queryKey: ["issue-labels", issueId],
    queryFn: async () => {
      const res = await commands.listIssueLabels(issueId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!issue,
  });

  const { data: allLabels = [] } = useQuery<IssueLabel[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await commands.listLabels();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: comments = [] } = useQuery<IssueComment[]>({
    queryKey: ["issue-comments", issueId],
    queryFn: async () => {
      const res = await commands.listIssueComments(issueId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!issue,
  });

  const { data: plant } = useQuery<Plant | null>({
    queryKey: ["plant", issue?.plant_id],
    queryFn: async () => {
      if (!issue?.plant_id) return null;
      const res = await commands.getPlant(issue.plant_id);
      if (res.status === "error") return null;
      return res.data;
    },
    enabled: !!issue?.plant_id,
  });

  const { data: location } = useQuery<Location | null>({
    queryKey: ["location", issue?.location_id],
    queryFn: async () => {
      if (!issue?.location_id) return null;
      const res = await commands.getLocation(issue.location_id);
      if (res.status === "error") return null;
      return res.data;
    },
    enabled: !!issue?.location_id,
  });

  const transitionStatus = useMutation({
    mutationFn: async (newStatus: IssueStatus) => {
      const res = await commands.transitionIssueStatus(issueId, newStatus);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      notifications.show({ message: "Status updated.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const changePriority = useMutation({
    mutationFn: async (newPriority: IssuePriority) => {
      const res = await commands.updateIssue(issueId, {
        title: null,
        description: null,
        status: null,
        priority: newPriority,
        plant_id: null,
        location_id: null,
      });
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const removeLabel = useMutation({
    mutationFn: async (labelId: number) => {
      const res = await commands.removeIssueLabel(issueId, labelId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["issue-labels", issueId] }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const addLabel = useMutation({
    mutationFn: async (labelId: number) => {
      const res = await commands.assignIssueLabel(issueId, labelId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["issue-labels", issueId] }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deleteIssue = useMutation({
    mutationFn: async () => {
      const res = await commands.deleteIssue(issueId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      notifications.show({ message: "Issue deleted.", color: "orange" });
      navigate({ to: "/issues" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const postComment = useMutation({
    mutationFn: async (body: string) => {
      const res = await commands.addIssueComment(issueId, body);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-comments", issueId] });
      setCommentBody("");
      notifications.show({ message: "Comment added.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteIssueComment(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["issue-comments", issueId] }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  if (isError || !issue) {
    return (
      <Stack p="md">
        <Text c="red">Issue not found.</Text>
        <Button variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => navigate({ to: "/issues" })}>
          Back to Issues
        </Button>
      </Stack>
    );
  }

  const labelIds = new Set(labels.map((l) => l.id));
  const availableLabels = allLabels.filter((l) => !labelIds.has(l.id));

  return (
    <Stack p="md" gap="md" maw={900}>
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate({ to: "/issues" })}
        >
          Issues
        </Button>
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconEdit size={14} />}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={() => deleteIssue.mutate()}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Title order={2}>
        <Text span c="dimmed" fw={400} size="lg" mr={6}>
          #{issue.id}
        </Text>
        {issue.title}
      </Title>

      {/* Status + Priority */}
      <Group gap="md" wrap="wrap">
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Status</Text>
          <Select
            size="xs"
            data={STATUS_OPTIONS}
            value={issue.status}
            onChange={(v) => v && transitionStatus.mutate(v as IssueStatus)}
            styles={{ input: { fontWeight: 600 } }}
          />
        </Box>
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Priority</Text>
          <Select
            size="xs"
            data={PRIORITY_OPTIONS}
            value={issue.priority}
            onChange={(v) => v && changePriority.mutate(v as IssuePriority)}
          />
        </Box>
      </Group>

      {/* Labels */}
      <Box>
        <Text size="xs" c="dimmed" mb={4}>Labels</Text>
        <Group gap={6}>
          {labels.map((l) => (
            <Badge
              key={l.id}
              color={l.color ?? "gray"}
              variant="filled"
              size="sm"
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  c="white"
                  onClick={() => removeLabel.mutate(l.id)}
                >
                  ×
                </ActionIcon>
              }
            >
              {l.name}
            </Badge>
          ))}
          {availableLabels.length > 0 && (
            <Select
              size="xs"
              placeholder="+ Add label"
              data={availableLabels.map((l) => ({ value: String(l.id), label: l.name }))}
              onChange={(v) => {
                if (v) {
                  addLabel.mutate(Number(v));
                }
              }}
              value={null}
              searchable
              clearable
              styles={{ input: { minWidth: 120 } }}
            />
          )}
        </Group>
      </Box>

      {/* Links */}
      {(plant || location) && (
        <Group gap="lg" wrap="wrap">
          {plant && (
            <Box>
              <Text size="xs" c="dimmed">Plant</Text>
              <Text
                size="sm"
                fw={500}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={() =>
                  navigate({
                    to: "/plants/individuals/$plantId",
                    params: { plantId: String(plant.id) },
                  })
                }
              >
                {plant.name}
              </Text>
            </Box>
          )}
          {location && (
            <Box>
              <Text size="xs" c="dimmed">Location</Text>
              <Text size="sm" fw={500}>{location.name}</Text>
            </Box>
          )}
        </Group>
      )}

      {/* Description */}
      {issue.description && (
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Description</Text>
          <Card withBorder p="sm" radius="sm">
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {issue.description}
            </Text>
          </Card>
        </Box>
      )}

      {/* Sidebar metadata */}
      <Group gap="lg" wrap="wrap">
        <Box>
          <Text size="xs" c="dimmed">Created</Text>
          <Text size="sm">{new Date(issue.created_at).toLocaleString()}</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">Updated</Text>
          <Text size="sm">{new Date(issue.updated_at).toLocaleString()}</Text>
        </Box>
        {issue.closed_at && (
          <Box>
            <Text size="xs" c="dimmed">Closed</Text>
            <Text size="sm">{new Date(issue.closed_at).toLocaleString()}</Text>
          </Box>
        )}
      </Group>

      <Divider />

      {/* Comments */}
      <Stack gap="sm">
        <Text fw={600}>Comments ({comments.length})</Text>
        {comments.map((c) => (
          <Card key={c.id} withBorder p="sm" radius="sm">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                {new Date(c.created_at).toLocaleString()}
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => deleteComment.mutate(c.id)}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {c.body}
            </Text>
          </Card>
        ))}

        <Box mt="xs">
          <Textarea
            placeholder="Add a comment…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end" mt="xs">
            <Button
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              disabled={!commentBody.trim()}
              loading={postComment.isPending}
              onClick={() => postComment.mutate(commentBody.trim())}
            >
              Post Comment
            </Button>
          </Group>
        </Box>
      </Stack>

      <IssueForm
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        existing={issue}
      />
    </Stack>
  );
}
