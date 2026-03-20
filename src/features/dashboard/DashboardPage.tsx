import {
  Box,
  Button,
  Center,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconEdit,
  IconLayoutDashboard,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardManager } from "./DashboardManager";
import { WidgetPicker } from "./WidgetPicker";
import type { ColSpan, WidgetConfig } from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function DashboardPage() {
  const envId = useAppStore((s) => s.activeEnvironmentId);
  const activeDashboardId = useAppStore((s) => s.activeDashboardId);
  const setActiveDashboardId = useAppStore((s) => s.setActiveDashboardId);
  const qc = useQueryClient();

  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<WidgetConfig[]>([]);
  const [pickerOpened, { open: openPicker, close: closePicker }] = useDisclosure(false);
  const [managerOpened, { open: openManager, close: closeManager }] = useDisclosure(false);

  // Debounced auto-save ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const effectiveEnvId = envId ?? 0;

  const { data: dashboards = [] } = useQuery({
    queryKey: ["dashboards", effectiveEnvId],
    queryFn: async () => {
      if (!envId) return [];
      const r = await commands.listDashboards(envId);
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    enabled: !!envId,
  });

  // Auto-select dashboard: persisted id → default → first
  useEffect(() => {
    if (dashboards.length === 0) return;
    const stillExists = dashboards.find((d) => d.id === activeDashboardId);
    if (stillExists) return;
    const def = dashboards.find((d) => d.is_default) ?? dashboards[0];
    setActiveDashboardId(def.id);
  }, [dashboards, activeDashboardId, setActiveDashboardId]);

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId) ?? null;

  // Load layout when active dashboard changes
  useEffect(() => {
    if (!activeDashboard) return;
    isFirstLoad.current = true;
    try {
      setLayout(JSON.parse(activeDashboard.layout_json) as WidgetConfig[]);
    } catch {
      setLayout([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboard?.id]);

  // Debounced save
  const saveMut = useMutation({
    mutationFn: async (newLayout: WidgetConfig[]) => {
      if (!activeDashboard) return;
      const r = await commands.updateDashboard(activeDashboard.id, {
        name: null,
        description: null,
        layout_json: JSON.stringify(newLayout),
        is_default: null,
      });
      if (r.status === "error") throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards", effectiveEnvId] });
    },
    onError: (e: Error) =>
      notifications.show({ color: "red", title: "Save failed", message: e.message }),
  });

  function scheduleSave(newLayout: WidgetConfig[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMut.mutate(newLayout);
    }, 1000);
  }

  function updateLayout(newLayout: WidgetConfig[]) {
    setLayout(newLayout);
    if (!isFirstLoad.current) {
      scheduleSave(newLayout);
    } else {
      isFirstLoad.current = false;
    }
  }

  function handleReorder(newOrder: WidgetConfig[]) {
    updateLayout(newOrder);
  }

  function handleRemove(id: string) {
    updateLayout(layout.filter((w) => w.id !== id));
  }

  function handleResize(id: string, span: ColSpan) {
    updateLayout(layout.map((w) => (w.id === id ? { ...w, col_span: span } : w)));
  }

  function handleAddWidget(config: WidgetConfig) {
    updateLayout([...layout, { ...config, id: uid() }]);
  }

  function handleManagerSelect(id: number) {
    if (id === -1) {
      setActiveDashboardId(null);
    } else {
      setActiveDashboardId(id);
    }
  }

  // ── No environment selected ──────────────────────────────────────────────
  if (!envId) {
    return (
      <Center h="60vh">
        <Stack align="center" gap="sm">
          <IconLayoutDashboard size={48} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">Select an environment from the sidebar to view your dashboard.</Text>
        </Stack>
      </Center>
    );
  }

  // ── No dashboards yet ────────────────────────────────────────────────────
  if (dashboards.length === 0) {
    return (
      <Center h="60vh">
        <Stack align="center" gap="md">
          <IconLayoutDashboard size={48} color="var(--mantine-color-dimmed)" />
          <Title order={3}>No dashboards yet</Title>
          <Text c="dimmed">Create your first dashboard to get started.</Text>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openManager}
          >
            Create Dashboard
          </Button>
          <DashboardManager
            opened={managerOpened}
            onClose={closeManager}
            envId={envId}
            activeDashboardId={activeDashboardId}
            onSelect={handleManagerSelect}
          />
        </Stack>
      </Center>
    );
  }

  // ── Main dashboard view ──────────────────────────────────────────────────
  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Select
            size="sm"
            value={activeDashboardId?.toString() ?? null}
            onChange={(v) => v && setActiveDashboardId(Number(v))}
            data={dashboards.map((d) => ({
              value: d.id.toString(),
              label: d.name,
            }))}
            style={{ minWidth: 200 }}
          />
        </Group>

        <Group gap="xs">
          {isEditMode && (
            <Button
              size="sm"
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={openPicker}
            >
              Add Widget
            </Button>
          )}
          <Button
            size="sm"
            variant={isEditMode ? "filled" : "default"}
            leftSection={<IconEdit size={16} />}
            onClick={() => setIsEditMode((v) => !v)}
          >
            {isEditMode ? "Done" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="default"
            leftSection={<IconSettings size={16} />}
            onClick={openManager}
          >
            Manage
          </Button>
        </Group>
      </Group>

      {/* Widget grid */}
      {layout.length === 0 ? (
        <Center h="40vh">
          <Stack align="center" gap="sm">
            <Text c="dimmed">This dashboard is empty.</Text>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={() => { setIsEditMode(true); openPicker(); }}
            >
              Add Widget
            </Button>
          </Stack>
        </Center>
      ) : (
        <DashboardGrid
          widgets={layout}
          envId={envId}
          isEditMode={isEditMode}
          onReorder={handleReorder}
          onRemove={handleRemove}
          onResize={handleResize}
        />
      )}

      {/* Modals */}
      <WidgetPicker
        opened={pickerOpened}
        onClose={closePicker}
        onAdd={handleAddWidget}
      />
      <DashboardManager
        opened={managerOpened}
        onClose={closeManager}
        envId={envId}
        activeDashboardId={activeDashboardId}
        onSelect={handleManagerSelect}
      />
    </Box>
  );
}
