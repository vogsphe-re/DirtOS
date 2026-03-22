import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NativeSelect,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDeviceDesktop, IconMoon, IconPlus, IconSun, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { commands } from "../lib/bindings";
import {
  BackupManagerPanel,
  IntegrationExtensionsPanel,
} from "../features/integrations/IntegrationExtensionsPanel";
import { LabelManager } from "../features/issues/LabelManager";
import { useAppStore } from "../stores/appStore";
import { useEnvironmentStore, type Environment } from "../stores/environmentStore";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

// Common timezones for the dropdown
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ---------------------------------------------------------------------------
// Environment form
// ---------------------------------------------------------------------------

interface EnvFormProps {
  initial?: Partial<Environment>;
  onSave: (data: EnvFormValues) => Promise<void>;
  onCancel?: () => void;
  busy: boolean;
}

interface EnvFormValues {
  name: string;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  timezone: string | null;
  climate_zone: string | null;
}

function EnvironmentForm({ initial, onSave, onCancel, busy }: EnvFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [latitude, setLatitude] = useState<number | string>(initial?.latitude ?? "");
  const [longitude, setLongitude] = useState<number | string>(initial?.longitude ?? "");
  const [elevation, setElevation] = useState<number | string>(initial?.elevation_m ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "");
  const [climateZone, setClimateZone] = useState(initial?.climate_zone ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      elevation_m: typeof elevation === "number" ? elevation : null,
      timezone: timezone.trim() || null,
      climate_zone: climateZone.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <TextInput
          label="Environment name"
          placeholder="Home Garden"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Group grow>
          <NumberInput
            label="Latitude"
            placeholder="40.7128"
            value={latitude}
            onChange={setLatitude}
            min={-90}
            max={90}
            decimalScale={6}
          />
          <NumberInput
            label="Longitude"
            placeholder="-74.006"
            value={longitude}
            onChange={setLongitude}
            min={-180}
            max={180}
            decimalScale={6}
          />
        </Group>
        <NumberInput
          label="Elevation (metres)"
          placeholder="10"
          value={elevation}
          onChange={setElevation}
          min={-500}
          max={9000}
        />
        <NativeSelect
          label="Timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.currentTarget.value)}
          data={[{ label: "— select —", value: "" }, ...COMMON_TIMEZONES]}
        />
        <TextInput
          label="Hardiness / climate zone"
          placeholder="7b"
          value={climateZone}
          onChange={(e) => setClimateZone(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt={4}>
          {onCancel && (
            <Button variant="subtle" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------

function SettingsPage() {
  const queryClient = useQueryClient();
  const activeId = useAppStore((s) => s.activeEnvironmentId);
  const setActiveId = useAppStore((s) => s.setActiveEnvironmentId);
  const colorScheme = useAppStore((s) => s.colorScheme);
  const setColorScheme = useAppStore((s) => s.setColorScheme);
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment);

  const [creatingNew, setCreatingNew] = useState(false);

  const { data: environments = [], isLoading } = useQuery({
    queryKey: ["environments"],
    queryFn: async () => {
      const result = await commands.listEnvironments();
      if (result.status !== "ok") throw new Error(result.error);
      return result.data as Environment[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: EnvFormValues) => {
      const result = await commands.createEnvironment(values);
      if (result.status !== "ok") throw new Error(result.error);
      return result.data as Environment;
    },
    onSuccess: (env) => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      setActiveId(env.id);
      setEnvironment(env);
      setCreatingNew(false);
      notifications.show({ color: "green", message: `"${env.name}" created.` });
    },
    onError: (e) => {
      notifications.show({ color: "red", title: "Error", message: String(e) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: EnvFormValues }) => {
      const result = await commands.updateEnvironment(id, values);
      if (result.status !== "ok") throw new Error(result.error);
      return result.data as Environment | null;
    },
    onSuccess: (env) => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      if (env && env.id === activeId) setEnvironment(env);
      notifications.show({ color: "green", message: "Environment updated." });
    },
    onError: (e) => {
      notifications.show({ color: "red", title: "Error", message: String(e) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const result = await commands.deleteEnvironment(id);
      if (result.status !== "ok") throw new Error(result.error);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      if (activeId === id) {
        setActiveId(null);
        setEnvironment(null);
      }
      notifications.show({ color: "green", message: "Environment deleted." });
    },
    onError: (e) => {
      notifications.show({ color: "red", title: "Error", message: String(e) });
    },
  });

  return (
    <Stack p="md" maw={720}>
      <Title order={2}>Settings</Title>

      <Card withBorder>
        <Title order={4} mb="xs">Appearance</Title>
        <Text size="sm" c="dimmed" mb="sm">
          Default theme follows your desktop setting.
        </Text>
        <SegmentedControl
          fullWidth
          value={colorScheme}
          onChange={(value) => setColorScheme(value as "light" | "dark" | "system")}
          data={[
            {
              value: "system",
              label: (
                <Group gap={6} justify="center">
                  <IconDeviceDesktop size={14} />
                  <span>System</span>
                </Group>
              ),
            },
            {
              value: "light",
              label: (
                <Group gap={6} justify="center">
                  <IconSun size={14} />
                  <span>Light</span>
                </Group>
              ),
            },
            {
              value: "dark",
              label: (
                <Group gap={6} justify="center">
                  <IconMoon size={14} />
                  <span>Dark</span>
                </Group>
              ),
            },
          ]}
        />
        <Text size="sm" c="dimmed" mt="sm">
          DirtOS uses Inter for interface text, IM Fell English for headings, and Roboto Mono for measurements and diagnostics.
        </Text>
      </Card>

      {/* ---- Environments section ---- */}
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>Environments</Title>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            variant="light"
            onClick={() => setCreatingNew(true)}
            disabled={creatingNew}
          >
            Add environment
          </Button>
        </Group>

        {creatingNew && (
          <>
            <EnvironmentForm
              onSave={async (values) => { await createMutation.mutateAsync(values); }}
              onCancel={() => setCreatingNew(false)}
              busy={createMutation.isPending}
            />
            <Divider my="md" />
          </>
        )}

        {isLoading && <Text c="dimmed" size="sm">Loading…</Text>}

        <Stack gap="md">
          {environments.map((env) => (
            <EnvironmentCard
              key={env.id}
              env={env}
              isActive={activeId === env.id}
              onActivate={() => {
                setActiveId(env.id);
                setEnvironment(env);
              }}
              onSave={(values) =>
                updateMutation.mutateAsync({ id: env.id, values })
              }
              onDelete={() => deleteMutation.mutate(env.id)}              busy={updateMutation.isPending || deleteMutation.isPending}
            />
          ))}
          {!isLoading && environments.length === 0 && !creatingNew && (
            <Text c="dimmed" size="sm">
              No environments yet. Add one above.
            </Text>
          )}
        </Stack>
      </Card>

      {/* ---- Issue Labels section ---- */}
      <Card withBorder>
        <LabelManager />
      </Card>

      {/* ---- Weather API Key section ---- */}
      <WeatherApiKeyCard />

      {/* ---- Trefle API Key section ---- */}
      <TrefleApiKeyCard />

      {/* ---- Integrations & Extensions ---- */}
      <IntegrationExtensionsPanel activeEnvironmentId={activeId} />

      {/* ---- Backups / Import Export ---- */}
      <BackupManagerPanel />

      <Card withBorder>
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={4}>About</Title>
            <Text size="sm" c="dimmed">
              Version, release details, and platform notes are available on the About page.
            </Text>
          </Stack>
          <Button component="a" href="/about" variant="light">
            Open About
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Weather API key card
// ---------------------------------------------------------------------------

function WeatherApiKeyCard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: currentKey } = useQuery<string | null>({
    queryKey: ["weather-api-key"],
    queryFn: async () => {
      const res = await commands.getWeatherApiKey();
      if (res.status === "error") return null;
      return res.data ?? null;
    },
  });

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await commands.setWeatherApiKey(key.trim());
      if (res.status === "error") throw new Error(res.error);
      notifications.show({ message: "API key saved", color: "green" });
      qc.invalidateQueries({ queryKey: ["weather-api-key"] });
      setEditing(false);
      setKey("");
    } catch (e) {
      notifications.show({ message: String(e), color: "red", title: "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Weather</Title>
        <Button size="xs" variant="subtle" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : currentKey ? "Change key" : "Add key"}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        OpenWeather API key:{" "}
        {currentKey ? (
          <Text component="span" c="green" size="sm">Configured ✓</Text>
        ) : (
          <Text component="span" c="orange" size="sm">Not set</Text>
        )}
      </Text>
      {editing && (
        <Stack gap="sm" mt="sm">
          <PasswordInput
            label="OpenWeather API key"
            description="Free tier key from openweathermap.org"
            placeholder="Paste your API key here…"
            value={key}
            onChange={(e) => setKey(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button onClick={save} loading={saving} disabled={!key.trim()}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Trefle API key card
// ---------------------------------------------------------------------------

function TrefleApiKeyCard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: currentKey } = useQuery<string | null>({
    queryKey: ["trefle-api-key"],
    queryFn: async () => {
      const res = await commands.getTrefleApiKey();
      if (res.status === "error") return null;
      return res.data ?? null;
    },
  });

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await commands.setTrefleApiKey(key.trim());
      if (res.status === "error") throw new Error(res.error);
      notifications.show({ message: "Trefle token saved", color: "green" });
      qc.invalidateQueries({ queryKey: ["trefle-api-key"] });
      setEditing(false);
      setKey("");
    } catch (e) {
      notifications.show({ message: String(e), color: "red", title: "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Trefle — Plant Data</Title>
        <Button size="xs" variant="subtle" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : currentKey ? "Change key" : "Add key"}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Trefle access token:{" "}
        {currentKey ? (
          <Text component="span" c="green" size="sm">Configured ✓</Text>
        ) : (
          <Text component="span" c="orange" size="sm">Not set</Text>
        )}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Provides growing info (sun, water, soil pH, hardiness zones, temperature).
        Free account at{" "}
        <Text component="a" href="https://trefle.io/users/sign_up" target="_blank" size="xs" c="blue">
          trefle.io
        </Text>
        . Rate limit: 60 req/min.
      </Text>
      {editing && (
        <Stack gap="sm" mt="sm">
          <PasswordInput
            label="Trefle access token"
            description="Copy from trefle.io/profile after signing up"
            placeholder="Paste your access token here…"
            value={key}
            onChange={(e) => setKey(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button onClick={save} loading={saving} disabled={!key.trim()}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Environment card (collapsible edit form)
// ---------------------------------------------------------------------------

interface EnvCardProps {
  env: Environment;
  isActive: boolean;
  onActivate: () => void;
  onSave: (values: EnvFormValues) => Promise<unknown>;
  onDelete: () => void;
  busy: boolean;
}

function EnvironmentCard({ env, isActive, onActivate, onSave, onDelete, busy }: EnvCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Box style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }} p="sm">
      <Group justify="space-between" mb={editing ? "sm" : 0}>
        <Group gap="sm">
          <Text fw={500}>{env.name}</Text>
          {isActive && <Badge size="xs" color="green">Active</Badge>}
        </Group>
        <Group gap={4}>
          {!isActive && (
            <Button size="xs" variant="subtle" onClick={onActivate}>
              Use
            </Button>
          )}
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
          <ActionIcon
            size="sm"
            color="red"
            variant="subtle"
            onClick={onDelete}
            aria-label="Delete environment"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {!editing && (
        <Text size="xs" c="dimmed" mt={4}>
          {[
            env.latitude != null && env.longitude != null
              ? `${env.latitude.toFixed(4)}, ${env.longitude.toFixed(4)}`
              : null,
            env.timezone,
            env.climate_zone ? `Zone ${env.climate_zone}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No location details"}
        </Text>
      )}

      {editing && (
        <EnvironmentForm
          initial={env}
          onSave={async (values) => {
            await onSave(values);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          busy={busy}
        />
      )}
    </Box>
  );
}

