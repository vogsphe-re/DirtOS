import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Issue, IssueLabel, Location, NewIssue, Plant } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./types";
import type { IssuePriority, IssueStatus } from "./types";

interface IssueFormProps {
  opened: boolean;
  onClose: () => void;
  existing?: Issue;
  defaultPlantId?: number;
  defaultLocationId?: number;
}

export function IssueForm({
  opened,
  onClose,
  existing,
  defaultPlantId,
  defaultLocationId,
}: IssueFormProps) {
  const queryClient = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<IssueStatus>(existing?.status ?? "new");
  const [priority, setPriority] = useState<IssuePriority>(existing?.priority ?? "medium");
  const [plantId, setPlantId] = useState<string | null>(
    existing?.plant_id ? String(existing.plant_id) : defaultPlantId ? String(defaultPlantId) : null
  );
  const [locationId, setLocationId] = useState<string | null>(
    existing?.location_id ? String(existing.location_id) : defaultLocationId ? String(defaultLocationId) : null
  );
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [titleError, setTitleError] = useState("");

  useQuery({
    queryKey: ["issue-labels-init", existing?.id, opened],
    queryFn: async () => {
      if (!existing?.id) return [];
      const res = await commands.listIssueLabels(existing.id);
      if (res.status === "error") throw new Error(res.error);
      setLabelIds(res.data.map((l) => String(l.id)));
      return res.data;
    },
    enabled: !!existing?.id && opened,
  });

  const { data: allLabels = [] } = useQuery<IssueLabel[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await commands.listLabels();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations", activeEnvId],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.listLocations(activeEnvId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 3) {
        setTitleError("Title must be at least 3 characters");
        throw new Error("Validation failed");
      }
      setTitleError("");

      let issue: Issue;
      if (existing) {
        const res = await commands.updateIssue(existing.id, {
          title: title || null,
          description: description || null,
          status: status || null,
          priority: priority || null,
          plant_id: plantId ? Number(plantId) : null,
          location_id: locationId ? Number(locationId) : null,
        });
        if (res.status === "error") throw new Error(res.error);
        issue = res.data!;

        const oldRes = await commands.listIssueLabels(existing.id);
        const oldIds = oldRes.status === "ok" ? oldRes.data.map((l) => l.id) : [];
        await Promise.all(oldIds.map((id) => commands.removeIssueLabel(existing.id, id)));
      } else {
        const input: NewIssue = {
          environment_id: activeEnvId,
          plant_id: plantId ? Number(plantId) : null,
          location_id: locationId ? Number(locationId) : null,
          title: title.trim(),
          description: description || null,
          status,
          priority,
        };
        const res = await commands.createIssue(input);
        if (res.status === "error") throw new Error(res.error);
        issue = res.data;
      }

      await Promise.all(
        labelIds.map((id) => commands.assignIssueLabel(issue.id, Number(id)))
      );

      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue-labels"] });
      notifications.show({
        message: existing ? "Issue updated." : "Issue created.",
        color: "green",
      });
      onClose();
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        notifications.show({ title: "Error", message: err.message, color: "red" });
      }
    },
  });

  const labelOptions = allLabels.map((l) => ({ value: String(l.id), label: l.name }));
  const plantOptions = plants.map((p) => ({ value: String(p.id), label: p.name }));
  const locationOptions = locations.map((l) => ({ value: String(l.id), label: l.name }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={existing ? "Edit Issue" : "New Issue"}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          label="Title"
          placeholder="Describe the issue..."
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          error={titleError}
        />
        <Textarea
          label="Description"
          placeholder="Details, observations, steps taken..."
          autosize
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group grow>
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => v && setStatus(v as IssueStatus)}
          />
          <Select
            label="Priority"
            data={PRIORITY_OPTIONS}
            value={priority}
            onChange={(v) => v && setPriority(v as IssuePriority)}
          />
        </Group>
        <MultiSelect
          label="Labels"
          placeholder="Pick labels"
          data={labelOptions}
          value={labelIds}
          onChange={setLabelIds}
          searchable
        />
        <Select
          label="Linked Plant"
          placeholder="None"
          data={plantOptions}
          value={plantId}
          onChange={setPlantId}
          searchable
          clearable
        />
        <Select
          label="Linked Location"
          placeholder="None"
          data={locationOptions}
          value={locationId}
          onChange={setLocationId}
          clearable
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            {existing ? "Save Changes" : "Create Issue"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
