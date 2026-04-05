import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDeviceDesktop,
  IconInfoCircle,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { markAppReady } from "../App";
import { commands } from "../lib/bindings";
import { useAppStore } from "../stores/appStore";
import { useEnvironmentStore, type Environment } from "../stores/environmentStore";
import { AppSplash, ErrorState } from "./LoadingStates";
import { Sidebar } from "./Sidebar";
import { NotificationCenter } from "./NotificationCenter";
import { InventoryModeOverlay } from "../features/inventory/InventoryModeOverlay";

// ---------------------------------------------------------------------------
// First-launch wizard
// ---------------------------------------------------------------------------

function SetupWizard({ onCreated }: { onCreated: (env: Environment) => void }) {
  const [opened, { close }] = useDisclosure(true);
  const [name, setName] = useState("My Garden");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await commands.createEnvironment({
        name: name.trim(),
        latitude: null,
        longitude: null,
        elevation_m: null,
        timezone: null,
        climate_zone: null,
      });
      if (result.status !== "ok") throw new Error(result.error);
      onCreated(result.data as Environment);
      close();
    } catch (e) {
      notifications.show({ color: "red", title: "Error", message: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    try {
      const seedResult = await commands.seedDemoGarden();
      if (seedResult.status !== "ok") throw new Error(seedResult.error);
      const envsResult = await commands.listEnvironments();
      if (envsResult.status !== "ok") throw new Error(envsResult.error);
      const demoEnv = (envsResult.data as Environment[]).find(
        (e) => e.name === "Demo Garden"
      );
      if (!demoEnv) throw new Error("Demo environment not found after seeding");
      onCreated(demoEnv);
      close();
    } catch (e) {
      notifications.show({ color: "red", title: "Error loading demo", message: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      title={<Title order={4}>Welcome to DirtOS 🌱</Title>}
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Let's set up your first growing environment. You can edit the details
          later in Settings.
        </Text>
        <TextInput
          label="Environment name"
          placeholder="Home Garden"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          required
          autoFocus
        />
        <Button onClick={handleCreate} loading={busy} fullWidth mt={4}>
          Create environment
        </Button>
        <Divider label="or" labelPosition="center" />
        <Button
          onClick={handleLoadDemo}
          loading={busy}
          fullWidth
          variant="light"
          color="green"
        >
          🌱 Load sample demo garden
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          Populates a full example garden with plants, harvests, issues, schedules, sensors, and more.
        </Text>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

async function fetchEnvironments(): Promise<Environment[]> {
  const result = await commands.listEnvironments();
  if (result.status !== "ok") throw new Error(result.error);
  return result.data as Environment[];
}

type StartupStatus = {
  ready: boolean;
  recovering: boolean;
  recovered_from_backup: boolean;
  message: string | null;
};

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const colorScheme = useAppStore((s) => s.colorScheme);
  const toggleColorScheme = useAppStore((s) => s.toggleColorScheme);
  const setColorScheme = useAppStore((s) => s.setColorScheme);
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId);
  const inventoryMode = useAppStore((s) => s.inventoryMode);
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment);

  const resolvedColorScheme =
    colorScheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : colorScheme;

  const {
    data: startupStatus,
    isLoading: startupLoading,
    refetch: refetchStartupStatus,
  } = useQuery<StartupStatus>({
    queryKey: ["app-startup-status"],
    queryFn: async () => {
      const result = await (commands as typeof commands & {
        getAppStartupStatus: () => Promise<{ status: "ok"; data: StartupStatus } | { status: "error"; error: string }>;
      }).getAppStartupStatus();
      if (result.status !== "ok") throw new Error(result.error);
      return result.data;
    },
    refetchInterval: (query) => (query.state.data?.ready ? false : 800),
    retry: false,
  });

  const { data: environments = [], isFetched } = useQuery({
    queryKey: ["environments"],
    queryFn: fetchEnvironments,
    staleTime: Infinity,
    enabled: startupStatus?.ready === true,
  });

  const showWizard = isFetched && environments.length === 0;

  // Sync active environment into store whenever the list or active ID changes.
  useEffect(() => {
    if (!isFetched || environments.length === 0) return;
    if (activeEnvironmentId === null) {
      const first = environments[0];
      setActiveEnvironmentId(first.id);
      setEnvironment(first);
    } else {
      const match = environments.find((e) => e.id === activeEnvironmentId);
      setEnvironment(match ?? null);
    }
  }, [isFetched, environments, activeEnvironmentId]); // eslint-disable-line

  const handleEnvChange = (value: string | null) => {
    if (!value) return;
    const id = parseInt(value, 10);
    const env = environments.find((e) => e.id === id) ?? null;
    setActiveEnvironmentId(id);
    setEnvironment(env);
  };

  const envOptions = environments.map((e) => ({
    value: String(e.id),
    label: e.name,
  }));

  useEffect(() => {
    markAppReady(startupStatus?.ready === true);
  }, [startupStatus?.ready]);

  // Once the app is ready, kick off background Trefle enrichment for any
  // species that don't yet have Trefle data. Fire-and-forget; errors are
  // silently ignored since this is a non-critical background operation.
  useEffect(() => {
    if (startupStatus?.ready !== true) return;
    commands.autoEnrichTrefle(null).catch(() => {/* no-op */});
  }, [startupStatus?.ready]); // eslint-disable-line

  if (startupLoading || !startupStatus) {
    return <AppSplash title="Starting DirtOS" message="Initializing the local database and desktop services." />;
  }

  if (!startupStatus.ready) {
    if (startupStatus.recovering) {
      return <AppSplash title="Recovering workspace" message={startupStatus.message ?? "Attempting to restore the last healthy backup."} />;
    }

    return (
      <Box p="md">
        <ErrorState
          title="Startup blocked"
          message={startupStatus.message ?? "DirtOS could not initialize its local workspace."}
          onRetry={() => refetchStartupStatus()}
        />
      </Box>
    );
  }

  return (
    <>
      <InventoryModeOverlay enabled={inventoryMode} />
      {showWizard && (
        <SetupWizard
          onCreated={(env) => {
            setActiveEnvironmentId(env.id);
            setEnvironment(env);
            queryClient.invalidateQueries({ queryKey: ["environments"] });
          }}
        />
      )}
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: sidebarCollapsed ? 64 : 240,
          breakpoint: "sm",
          collapsed: { mobile: !mobileOpened },
        }}
        padding={0}
      >
        {/* ---- Header ---- */}
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="sm">
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
              />
              <ActionIcon
                variant="subtle"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                visibleFrom="sm"
                size="sm"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <IconChevronRight size={16} />
                ) : (
                  <IconChevronLeft size={16} />
                )}
              </ActionIcon>
              <Title order={5} visibleFrom="sm" style={{ letterSpacing: "-0.02em" }}>
                DirtOS
              </Title>
              {startupStatus.recovered_from_backup && (
                <Card p="4px 10px" radius="xl" withBorder style={{ background: "transparent" }}>
                  <Text size="xs">Recovered from backup</Text>
                </Card>
              )}
            </Group>

            <Group gap="xs">
              <Select
                size="xs"
                placeholder={isFetched ? "No environment" : "Loading…"}
                value={activeEnvironmentId ? String(activeEnvironmentId) : null}
                onChange={handleEnvChange}
                data={envOptions}
                w={180}
                aria-label="Active environment"
                disabled={environments.length === 0}
              />
              <ActionIcon
                variant="subtle"
                onClick={() => toggleColorScheme(resolvedColorScheme)}
                size="md"
                aria-label="Toggle color scheme"
              >
                {resolvedColorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="md"
                aria-label="Use system color scheme"
                color={colorScheme === "system" ? "green" : undefined}
                onClick={() => setColorScheme("system")}
              >
                <IconDeviceDesktop size={18} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="md"
                aria-label="About DirtOS"
                onClick={() => navigate({ to: "/about" })}
              >
                <IconInfoCircle size={18} />
              </ActionIcon>
              <NotificationCenter />
            </Group>
          </Group>
        </AppShell.Header>

        {/* ---- Sidebar ---- */}
        <AppShell.Navbar>
          <Box h="100%" py={4}>
            <Sidebar collapsed={sidebarCollapsed} />
          </Box>
        </AppShell.Navbar>

        {/* ---- Content ---- */}
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
