import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconStar, IconTrash, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { Dashboard } from "../../lib/bindings";
import { DASHBOARD_TEMPLATES } from "./templates";

// ── Inline rename row ──────────────────────────────────────────────────────

function DashboardRow({
  dashboard,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onSetDefault,
}: {
  dashboard: Dashboard;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onSetDefault: () => void;
}) {
  const [editing, { open: startEdit, close: stopEdit }] = useDisclosure(false);
  const [value, setValue] = useState(dashboard.name);

  function commitRename() {
    if (value.trim() && value.trim() !== dashboard.name) {
      onRename(value.trim());
    }
    stopEdit();
  }

  return (
    <Group justify="space-between" wrap="nowrap">
      {editing ? (
        <TextInput
          size="xs"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") stopEdit();
          }}
          autoFocus
          style={{ flex: 1 }}
          rightSection={
            <ActionIcon size="xs" variant="subtle" onClick={commitRename}>
              <IconCheck size={12} />
            </ActionIcon>
          }
        />
      ) : (
        <Box
          style={{ flex: 1, cursor: "pointer" }}
          onClick={onSelect}
        >
          <Group gap={6}>
            <Text size="sm" fw={isActive ? 700 : 400}>
              {dashboard.name}
            </Text>
            {dashboard.is_default && (
              <Badge size="xs" color="yellow" variant="light">
                Default
              </Badge>
            )}
          </Group>
          {dashboard.description && (
            <Text size="xs" c="dimmed">{dashboard.description}</Text>
          )}
        </Box>
      )}

      <Group gap={4} wrap="nowrap">
        <Tooltip label="Set as default" withArrow>
          <ActionIcon
            size="sm"
            variant={dashboard.is_default ? "filled" : "subtle"}
            color="yellow"
            onClick={onSetDefault}
          >
            <IconStar size={13} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Rename" withArrow>
          <ActionIcon size="sm" variant="subtle" onClick={startEdit}>
            <IconPencil size={13} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete" withArrow>
          <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}>
            <IconTrash size={13} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

// ── DashboardManager modal ─────────────────────────────────────────────────

interface DashboardManagerProps {
  opened: boolean;
  onClose: () => void;
  envId: number;
  activeDashboardId: number | null;
  onSelect: (id: number) => void;
}

export function DashboardManager({
  opened,
  onClose,
  envId,
  activeDashboardId,
  onSelect,
}: DashboardManagerProps) {
  const qc = useQueryClient();

  const { data: dashboards = [] } = useQuery({
    queryKey: ["dashboards", envId],
    queryFn: async () => {
      const r = await commands.listDashboards(envId);
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    enabled: opened,
  });

  const createMut = useMutation({
    mutationFn: async (input: Parameters<typeof commands.createDashboard>[0]) => {
      const r = await commands.createDashboard(input);
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dashboards", envId] });
      onSelect(data.id);
    },
    onError: (e: Error) =>
      notifications.show({ color: "red", title: "Error", message: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Parameters<typeof commands.updateDashboard>[1] }) => {
      const r = await commands.updateDashboard(id, patch);
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboards", envId] }),
    onError: (e: Error) =>
      notifications.show({ color: "red", title: "Error", message: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await commands.deleteDashboard(id);
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["dashboards", envId] });
      if (id === activeDashboardId) onSelect(-1);
    },
    onError: (e: Error) =>
      notifications.show({ color: "red", title: "Error", message: e.message }),
  });

  function createBlank() {
    createMut.mutate({
      environment_id: envId,
      name: "New Dashboard",
      description: null,
      template_key: null,
      layout_json: "[]",
      is_default: dashboards.length === 0,
    });
  }

  function createFromTemplate(tpl: (typeof DASHBOARD_TEMPLATES)[number]) {
    createMut.mutate({
      environment_id: envId,
      name: tpl.name,
      description: tpl.description,
      template_key: tpl.key,
      layout_json: JSON.stringify(tpl.defaultWidgets()),
      is_default: dashboards.length === 0,
    });
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manage Dashboards"
      size="lg"
    >
      <Stack gap="md">
        {/* Existing dashboards */}
        {dashboards.length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm">My Dashboards</Text>
            {dashboards.map((d) => (
              <DashboardRow
                key={d.id}
                dashboard={d}
                isActive={d.id === activeDashboardId}
                onSelect={() => { onSelect(d.id); onClose(); }}
                onDelete={() => deleteMut.mutate(d.id)}
                onRename={(name) => updateMut.mutate({ id: d.id, patch: { name, description: null, layout_json: null, is_default: null } })}
                onSetDefault={() => updateMut.mutate({ id: d.id, patch: { name: null, description: null, layout_json: null, is_default: !d.is_default } })}
              />
            ))}
          </Stack>
        )}

        <Group justify="flex-end">
          <Button size="xs" variant="default" onClick={createBlank} loading={createMut.isPending}>
            + Blank Dashboard
          </Button>
        </Group>

        <Divider label="Start from a template" labelPosition="center" />

        {/* Template cards */}
        <SimpleGrid cols={2} spacing="sm">
          {DASHBOARD_TEMPLATES.map((tpl) => (
            <Card
              key={tpl.key}
              withBorder
              padding="sm"
              style={{ cursor: "pointer" }}
              onClick={() => createFromTemplate(tpl)}
            >
              <Text fw={600} size="sm">{tpl.name}</Text>
              <Text size="xs" c="dimmed">{tpl.description}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}
