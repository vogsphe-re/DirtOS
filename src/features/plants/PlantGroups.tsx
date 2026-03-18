import {
  ActionIcon,
  Badge,
  Button,
  Card,
  ColorInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
  IconUserPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import type { Plant } from "./types";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface PlantGroup {
  id: number;
  environment_id: number | null;
  name: string;
  description: string | null;
  group_type: string | null;
  color: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// GroupMembersModal — view / add / remove plants in a group
// ---------------------------------------------------------------------------

interface GroupMembersModalProps {
  group: PlantGroup;
  opened: boolean;
  onClose: () => void;
}

function GroupMembersModal({ group, opened, onClose }: GroupMembersModalProps) {
  const queryClient = useQueryClient();
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["plant-group-plants", group.id],
    queryFn: async () => {
      const res = await commands.listPlantGroupPlants(group.id);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
    enabled: opened,
  });

  const { data: allPlants = [] } = useQuery({
    queryKey: ["plants-all"],
    queryFn: async () => {
      const res = await commands.listAllPlants(500, 0);
      if (res.status === "error") throw new Error(res.error);
      return res.data as Plant[];
    },
    enabled: opened,
  });

  const memberIds = new Set(members.map((m) => m.id));
  const candidatePlants = allPlants.filter((p) => !memberIds.has(p.id));

  const addMutation = useMutation({
    mutationFn: async (plantId: number) => {
      const res = await commands.addPlantToGroup(group.id, plantId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant-group-plants", group.id] });
      setSelectedPlantId(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (plantId: number) => {
      const res = await commands.removePlantFromGroup(group.id, plantId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant-group-plants", group.id] }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Members: ${group.name}`}
      size="sm"
    >
      <Stack gap="sm">
        {/* Add plant */}
        <Group gap="xs" align="flex-end">
          <Select
            label="Add plant"
            placeholder="Select plant…"
            data={candidatePlants.map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
            value={selectedPlantId}
            onChange={setSelectedPlantId}
            searchable
            clearable
            style={{ flex: 1 }}
          />
          <Button
            size="xs"
            leftSection={<IconUserPlus size={14} />}
            disabled={selectedPlantId == null}
            loading={addMutation.isPending}
            onClick={() => selectedPlantId && addMutation.mutate(Number(selectedPlantId))}
          >
            Add
          </Button>
        </Group>

        {/* Members list */}
        {members.length === 0 ? (
          <Text size="sm" c="dimmed">
            No members yet.
          </Text>
        ) : (
          <Stack gap={4}>
            {members.map((plant) => (
              <Group key={plant.id} justify="space-between">
                <Text size="sm">{plant.name}</Text>
                <Tooltip label="Remove from group">
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => removeMutation.mutate(plant.id)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// GroupFormModal — create or edit a group
// ---------------------------------------------------------------------------

interface GroupFormModalProps {
  initial?: PlantGroup;
  environmentId: number;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function GroupFormModal({ initial, environmentId, opened, onClose, onSaved }: GroupFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [groupType, setGroupType] = useState(initial?.group_type ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4dabf7");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (initial) {
        const res = await commands.updatePlantGroup(initial.id, {
          name: name.trim(),
          description: description.trim() || null,
          group_type: groupType.trim() || null,
          color: color || null,
        });
        if (res.status === "error") throw new Error(res.error);
      } else {
        const res = await commands.createPlantGroup({
          environment_id: environmentId,
          name: name.trim(),
          description: description.trim() || null,
          group_type: groupType.trim() || null,
          color: color || null,
        });
        if (res.status === "error") throw new Error(res.error);
      }
    },
    onSuccess: () => {
      notifications.show({ message: `Group ${initial ? "updated" : "created"}.`, color: "green" });
      onSaved();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={initial ? "Edit Group" : "New Group"}
      size="sm"
    >
      <Stack gap="sm">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <TextInput
          label="Group type"
          placeholder="e.g. strain, bed, batch"
          value={groupType}
          onChange={(e) => setGroupType(e.currentTarget.value)}
        />
        <ColorInput
          label="Color"
          value={color}
          onChange={setColor}
          format="hex"
        />
        <Button
          loading={saveMutation.isPending}
          disabled={!name.trim()}
          onClick={() => saveMutation.mutate()}
        >
          {initial ? "Save changes" : "Create group"}
        </Button>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PlantGroups — main component
// ---------------------------------------------------------------------------

export function PlantGroups() {
  const queryClient = useQueryClient();
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlantGroup | null>(null);
  const [membersTarget, setMembersTarget] = useState<PlantGroup | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["plant-groups", activeEnvId],
    queryFn: async () => {
      const res = await commands.listPlantGroups(activeEnvId!, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data as PlantGroup[];
    },
    enabled: activeEnvId != null,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deletePlantGroup(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant-groups", activeEnvId] });
      notifications.show({ message: "Group deleted.", color: "orange" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (!activeEnvId) {
    return (
      <Stack p="md">
        <Text c="dimmed">Select an environment to manage plant groups.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <IconUsers size={22} />
          <Title order={2}>Plant Groups</Title>
        </Group>
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          New group
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading…</Text>
      ) : groups.length === 0 ? (
        <Text c="dimmed">No groups yet. Create one to organise plants by strain, bed, or batch.</Text>
      ) : (
        <Stack gap="sm">
          {groups.map((g) => (
            <Card key={g.id} shadow="xs" padding="sm" radius="sm" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  {g.color && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        backgroundColor: g.color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text fw={600} size="sm">
                        {g.name}
                      </Text>
                      {g.group_type && (
                        <Badge size="xs" variant="outline">
                          {g.group_type}
                        </Badge>
                      )}
                    </Group>
                    {g.description && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {g.description}
                      </Text>
                    )}
                  </Stack>
                </Group>

                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Members">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => setMembersTarget(g)}
                    >
                      <IconUsers size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => setEditTarget(g)}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMutation.mutate(g.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Create modal */}
      <GroupFormModal
        environmentId={activeEnvId}
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["plant-groups", activeEnvId] });
        }}
      />

      {/* Edit modal */}
      {editTarget && (
        <GroupFormModal
          initial={editTarget}
          environmentId={activeEnvId}
          opened={editTarget != null}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            queryClient.invalidateQueries({ queryKey: ["plant-groups", activeEnvId] });
          }}
        />
      )}

      {/* Members modal */}
      {membersTarget && (
        <GroupMembersModal
          group={membersTarget}
          opened={membersTarget != null}
          onClose={() => setMembersTarget(null)}
        />
      )}
    </Stack>
  );
}
