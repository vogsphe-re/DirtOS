import {
  ActionIcon,
  Badge,
  Button,
  ColorInput,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { IssueLabel, NewIssueLabel } from "../../lib/bindings";

interface EditModalProps {
  label?: IssueLabel;
  opened: boolean;
  onClose: () => void;
}

function LabelEditModal({ label, opened, onClose }: EditModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? "#74C0FC");
  const [icon, setIcon] = useState(label?.icon ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (label) {
        const res = await commands.updateLabel(label.id, {
          name: name || null,
          color: color || null,
          icon: icon || null,
        });
        if (res.status === "error") throw new Error(res.error);
      } else {
        const input: NewIssueLabel = {
          name: name.trim(),
          color: color || null,
          icon: icon || null,
        };
        const res = await commands.createLabel(input);
        if (res.status === "error") throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      notifications.show({
        message: label ? "Label updated." : "Label created.",
        color: "green",
      });
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={label ? "Edit Label" : "New Label"}
      size="sm"
    >
      <Stack gap="sm">
        <TextInput
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <ColorInput
          label="Color"
          format="hex"
          value={color}
          onChange={setColor}
        />
        <TextInput
          label="Icon name (Tabler)"
          placeholder="e.g. bug, leaf, droplet"
          value={icon}
          onChange={(e) => setIcon(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {label ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function LabelManager() {
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<IssueLabel | undefined>();
  const [editOpen, setEditOpen] = useState(false);

  const { data: labels = [], isLoading } = useQuery<IssueLabel[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await commands.listLabels();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteLabel(id);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      notifications.show({ message: "Label deleted.", color: "orange" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  const openCreate = () => {
    setEditTarget(undefined);
    setEditOpen(true);
  };

  const openEdit = (label: IssueLabel) => {
    setEditTarget(label);
    setEditOpen(true);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Issue Labels</Title>
        <Button
          size="compact-sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          New Label
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed" size="sm">Loading...</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Icon</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {labels.map((label) => (
              <Table.Tr key={label.id}>
                <Table.Td>
                  <Badge color={label.color ?? "gray"} variant="filled">
                    {label.name}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{label.icon ?? "-"}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => openEdit(label)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMutation.mutate(label.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {labels.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center">No labels yet.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <LabelEditModal
        label={editTarget}
        opened={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </Stack>
  );
}
