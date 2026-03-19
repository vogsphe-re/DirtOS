import {
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconExternalLink, IconRefresh, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { commands } from "../../lib/bindings";

type Provider = "inaturalist" | "wikipedia" | "osm" | "home_assistant" | "n8n";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "inaturalist", label: "iNaturalist" },
  { value: "wikipedia", label: "Wikipedia" },
  { value: "osm", label: "OpenStreetMap" },
  { value: "home_assistant", label: "Home Assistant" },
  { value: "n8n", label: "n8n" },
];

export function IntegrationExtensionsPanel({ activeEnvironmentId }: { activeEnvironmentId: number | null }) {
  const qc = useQueryClient();
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [osmQuery, setOsmQuery] = useState("");
  const [webhookProvider, setWebhookProvider] = useState<Provider>("n8n");
  const [webhookName, setWebhookName] = useState("");
  const [callbackProvider, setCallbackProvider] = useState<Provider>("n8n");
  const [callbackToken, setCallbackToken] = useState("");
  const [callbackPayload, setCallbackPayload] = useState('{"sensor_id": 1, "value": 22.5, "unit": "C"}');

  const { data: integrationConfigs = [] } = useQuery({
    queryKey: ["integration-configs"],
    queryFn: async () => {
      const res = await (commands as any).listIntegrationConfigs();
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const configByProvider = useMemo(() => {
    const map = new Map<Provider, any>();
    integrationConfigs.forEach((cfg) => map.set(cfg.provider as Provider, cfg));
    return map;
  }, [integrationConfigs]);

  const { data: species = [] } = useQuery({
    queryKey: ["integration-species"],
    queryFn: async () => {
      const res = await (commands as any).listSpeciesForIntegration(200);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const { data: speciesSources = [] } = useQuery({
    queryKey: ["species-external-sources", selectedSpeciesId],
    queryFn: async () => {
      if (!selectedSpeciesId) return [];
      const res = await (commands as any).listSpeciesExternalSources(Number(selectedSpeciesId));
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
    enabled: !!selectedSpeciesId,
  });

  const { data: syncRuns = [] } = useQuery({
    queryKey: ["integration-sync-runs"],
    queryFn: async () => {
      const res = await (commands as any).listIntegrationSyncRuns(null, 40);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const { data: mapSetting } = useQuery({
    queryKey: ["environment-map-setting", activeEnvironmentId],
    queryFn: async () => {
      if (!activeEnvironmentId) return null;
      const res = await (commands as any).getEnvironmentMapSetting(activeEnvironmentId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any | null;
    },
    enabled: !!activeEnvironmentId,
  });

  const [mapLat, setMapLat] = useState<number | string>("");
  const [mapLon, setMapLon] = useState<number | string>("");
  const [mapZoom, setMapZoom] = useState<number | string>(14);
  const [mapPrivacy, setMapPrivacy] = useState("private");
  const [weatherOverlay, setWeatherOverlay] = useState(false);
  const [soilOverlay, setSoilOverlay] = useState(false);
  const [allowSharing, setAllowSharing] = useState(false);
  const [boundariesGeojson, setBoundariesGeojson] = useState("");

  const { data: osmResults = [] } = useQuery({
    queryKey: ["osm-search", osmQuery],
    queryFn: async () => {
      if (!osmQuery.trim()) return [];
      const res = await (commands as any).searchOsmPlaces(osmQuery, 8);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
    enabled: osmQuery.trim().length > 2,
  });

  const { data: webhookTokens = [] } = useQuery({
    queryKey: ["integration-webhook-tokens", webhookProvider],
    queryFn: async () => {
      const res = await (commands as any).listIntegrationWebhookTokens(webhookProvider);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const { data: automationEvents = [] } = useQuery({
    queryKey: ["automation-events"],
    queryFn: async () => {
      const res = await (commands as any).listAutomationEvents(null, 30);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: Provider; enabled: boolean }) => {
      const cfg = configByProvider.get(provider);
      const res = await (commands as any).upsertIntegrationConfig(provider, {
        enabled,
        auth_json: cfg?.auth_json ?? null,
        settings_json: cfg?.settings_json ?? null,
        sync_interval_minutes: cfg?.sync_interval_minutes ?? 1440,
        cache_ttl_minutes: cfg?.cache_ttl_minutes ?? 240,
        rate_limit_per_minute: cfg?.rate_limit_per_minute ?? 60,
      });
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-configs"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Error", message: e.message }),
  });

  const syncSpecies = useMutation({
    mutationFn: async (speciesId: number) => {
      const res = await (commands as any).syncSpeciesExternalSources(speciesId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["species-external-sources", selectedSpeciesId] });
      qc.invalidateQueries({ queryKey: ["integration-sync-runs"] });
      notifications.show({
        color: data.errors?.length ? "orange" : "green",
        title: "Species sync complete",
        message: data.errors?.length
          ? `Synced: ${data.synced_providers.join(", ")}; errors: ${data.errors.join("; ")}`
          : `Synced providers: ${data.synced_providers.join(", ") || "none"}`,
      });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Sync failed", message: e.message }),
  });

  const saveMap = useMutation({
    mutationFn: async () => {
      if (!activeEnvironmentId) throw new Error("No active environment selected");
      const res = await (commands as any).upsertEnvironmentMapSetting(activeEnvironmentId, {
        latitude: typeof mapLat === "number" ? mapLat : null,
        longitude: typeof mapLon === "number" ? mapLon : null,
        zoom_level: typeof mapZoom === "number" ? mapZoom : 14,
        geocode_json: null,
        weather_overlay: weatherOverlay,
        soil_overlay: soilOverlay,
        boundaries_geojson: boundariesGeojson.trim() || null,
        privacy_level: mapPrivacy,
        allow_sharing: allowSharing,
      });
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["environment-map-setting", activeEnvironmentId] });
      notifications.show({ color: "green", message: "Map settings saved." });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Map settings", message: e.message }),
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).createIntegrationWebhookToken(webhookProvider, webhookName || "Default token");
      if (res.status === "error") throw new Error(res.error);
      return res.data as any;
    },
    onSuccess: (token) => {
      setWebhookName("");
      setCallbackToken(token.token);
      qc.invalidateQueries({ queryKey: ["integration-webhook-tokens", webhookProvider] });
      notifications.show({ color: "green", message: "Webhook token created." });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Token creation", message: e.message }),
  });

  const sendCallback = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).processIntegrationCallback(callbackProvider, callbackToken.trim(), callbackPayload);
      if (res.status === "error") throw new Error(res.error);
      return res.data as string;
    },
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ["automation-events"] });
      notifications.show({ color: "green", title: "Callback accepted", message: msg });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Callback failed", message: e.message }),
  });

  const speciesOptions = species.map((s) => ({ value: String(s.id), label: s.common_name }));

  const selectedSourceByProvider = (provider: Provider) =>
    speciesSources.find((src: any) => src.provider === provider);

  const mapFrameUrl =
    typeof mapLat === "number" && typeof mapLon === "number"
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapLon - 0.02}%2C${mapLat - 0.02}%2C${mapLon + 0.02}%2C${mapLat + 0.02}&layer=mapnik&marker=${mapLat}%2C${mapLon}`
      : null;

  return (
    <Card withBorder>
      <Title order={4} mb="md">Integrations & Extensions</Title>
      <Tabs defaultValue="knowledge">
        <Tabs.List>
          <Tabs.Tab value="knowledge">Knowledge</Tabs.Tab>
          <Tabs.Tab value="maps">Maps</Tabs.Tab>
          <Tabs.Tab value="automation">Automation</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="knowledge" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {PROVIDERS.map((provider) => (
                <Card key={provider.value} withBorder>
                  <Group justify="space-between" mb={6}>
                    <Text fw={600}>{provider.label}</Text>
                    <Switch
                      size="sm"
                      checked={!!configByProvider.get(provider.value)?.enabled}
                      onChange={(e) =>
                        upsertConfig.mutate({
                          provider: provider.value,
                          enabled: e.currentTarget.checked,
                        })
                      }
                    />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {configByProvider.get(provider.value)?.last_error || "No recent errors"}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>

            <Divider />

            <Group align="end">
              <Select
                label="Species"
                placeholder="Select species"
                searchable
                data={speciesOptions}
                value={selectedSpeciesId}
                onChange={setSelectedSpeciesId}
                w={280}
              />
              <Button
                leftSection={<IconRefresh size={14} />}
                disabled={!selectedSpeciesId}
                loading={syncSpecies.isPending}
                onClick={() => selectedSpeciesId && syncSpecies.mutate(Number(selectedSpeciesId))}
              >
                Sync iNaturalist + Wikipedia
              </Button>
            </Group>

            {selectedSpeciesId && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <SourceCard source={selectedSourceByProvider("inaturalist")} title="iNaturalist source" />
                <SourceCard source={selectedSourceByProvider("wikipedia")} title="Wikipedia source" />
              </SimpleGrid>
            )}

            <Card withBorder>
              <Text fw={600} mb={6}>Recent Sync Runs</Text>
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Error</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {syncRuns.slice(0, 6).map((run: any) => (
                    <Table.Tr key={run.id}>
                      <Table.Td>{run.provider}</Table.Td>
                      <Table.Td>
                        <Badge color={run.status === "success" ? "green" : run.status === "error" ? "red" : "blue"}>
                          {run.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{String(run.started_at)}</Table.Td>
                      <Table.Td>{run.error_message || "-"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="maps" pt="md">
          <Stack gap="md">
            <Group align="end">
              <TextInput
                label="Find place"
                placeholder="Search city, park, address"
                value={osmQuery}
                onChange={(e) => setOsmQuery(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                w={360}
              />
              <Text size="sm" c="dimmed">OSM geocoding with Nominatim</Text>
            </Group>

            {osmResults.length > 0 && (
              <Card withBorder>
                <Stack gap={6}>
                  {osmResults.map((place: any, idx: number) => (
                    <Button
                      key={`${place.display_name}-${idx}`}
                      variant="subtle"
                      justify="left"
                      onClick={() => {
                        setMapLat(place.latitude);
                        setMapLon(place.longitude);
                      }}
                    >
                      {place.display_name}
                    </Button>
                  ))}
                </Stack>
              </Card>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <NumberInput label="Latitude" value={mapLat} onChange={setMapLat} min={-90} max={90} decimalScale={6} />
              <NumberInput label="Longitude" value={mapLon} onChange={setMapLon} min={-180} max={180} decimalScale={6} />
              <NumberInput label="Zoom" value={mapZoom} onChange={setMapZoom} min={1} max={20} />
            </SimpleGrid>

            <Group>
              <Select
                label="Privacy"
                value={mapPrivacy}
                onChange={(v) => setMapPrivacy(v || "private")}
                data={[
                  { value: "private", label: "Private" },
                  { value: "obfuscated", label: "Obfuscated" },
                  { value: "shared", label: "Shared" },
                ]}
              />
              <Checkbox label="Weather overlay" checked={weatherOverlay} onChange={(e) => setWeatherOverlay(e.currentTarget.checked)} />
              <Checkbox label="Soil overlay" checked={soilOverlay} onChange={(e) => setSoilOverlay(e.currentTarget.checked)} />
              <Checkbox label="Allow sharing" checked={allowSharing} onChange={(e) => setAllowSharing(e.currentTarget.checked)} />
            </Group>

            <Textarea
              label="Garden boundaries (GeoJSON)"
              minRows={3}
              value={boundariesGeojson}
              onChange={(e) => setBoundariesGeojson(e.currentTarget.value)}
              placeholder='{"type":"FeatureCollection","features":[]}'
            />

            <Group>
              <Button loading={saveMap.isPending} onClick={() => saveMap.mutate()} disabled={!activeEnvironmentId}>
                Save map settings
              </Button>
              {!activeEnvironmentId && <Text size="sm" c="orange">Select an active environment first.</Text>}
            </Group>

            {mapFrameUrl && (
              <Card withBorder>
                <iframe
                  title="OpenStreetMap"
                  src={mapFrameUrl}
                  style={{ width: "100%", height: 320, border: 0 }}
                />
              </Card>
            )}

            {mapSetting && (
              <Text size="xs" c="dimmed">
                Last saved map setting updated at {String(mapSetting.updated_at)}.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="automation" pt="md">
          <Stack gap="md">
            <Group align="end">
              <Select
                label="Token provider"
                data={[
                  { value: "home_assistant", label: "Home Assistant" },
                  { value: "n8n", label: "n8n" },
                ]}
                value={webhookProvider}
                onChange={(v) => setWebhookProvider((v as Provider) || "n8n")}
                w={200}
              />
              <TextInput
                label="Token name"
                placeholder="Garden automations"
                value={webhookName}
                onChange={(e) => setWebhookName(e.currentTarget.value)}
                w={260}
              />
              <Button onClick={() => createToken.mutate()} loading={createToken.isPending}>Create token</Button>
            </Group>

            <Card withBorder>
              <Text fw={600} mb={8}>Active tokens</Text>
              <Stack gap={6}>
                {webhookTokens.map((t: any) => (
                  <Code key={t.id} block>
                    {t.provider} | {t.name} | {t.token}
                  </Code>
                ))}
              </Stack>
            </Card>

            <Card withBorder>
              <Text fw={600} mb={8}>Test callback ingestion</Text>
              <Group align="end">
                <Select
                  label="Callback provider"
                  data={[
                    { value: "home_assistant", label: "Home Assistant" },
                    { value: "n8n", label: "n8n" },
                  ]}
                  value={callbackProvider}
                  onChange={(v) => setCallbackProvider((v as Provider) || "n8n")}
                  w={200}
                />
                <TextInput
                  label="Token"
                  value={callbackToken}
                  onChange={(e) => setCallbackToken(e.currentTarget.value)}
                  w={360}
                />
              </Group>
              <Textarea
                mt="sm"
                label="Payload JSON"
                minRows={4}
                value={callbackPayload}
                onChange={(e) => setCallbackPayload(e.currentTarget.value)}
              />
              <Button mt="sm" onClick={() => sendCallback.mutate()} loading={sendCallback.isPending}>
                Send callback
              </Button>
            </Card>

            <Card withBorder>
              <Text fw={600} mb={8}>Recent automation events</Text>
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {automationEvents.slice(0, 8).map((event: any) => (
                    <Table.Tr key={event.id}>
                      <Table.Td>{event.provider}</Table.Td>
                      <Table.Td>{event.event_type}</Table.Td>
                      <Table.Td>{event.status}</Table.Td>
                      <Table.Td>{String(event.created_at)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}

function SourceCard({ source, title }: { source: any; title: string }) {
  return (
    <Card withBorder>
      <Text fw={600} mb={6}>{title}</Text>
      {!source ? (
        <Text size="sm" c="dimmed">No synced source data yet.</Text>
      ) : (
        <Stack gap={6}>
          <Text size="sm">External ID: {source.external_id || "-"}</Text>
          <Text size="sm">Attribution: {source.attribution || "-"}</Text>
          <Text size="sm">Last synced: {String(source.last_synced_at)}</Text>
          {source.source_url && (
            <Button
              component="a"
              href={source.source_url}
              target="_blank"
              size="xs"
              variant="light"
              leftSection={<IconExternalLink size={14} />}
            >
              Open source page
            </Button>
          )}
        </Stack>
      )}
    </Card>
  );
}

export function BackupManagerPanel() {
  const qc = useQueryClient();
  const [jobName, setJobName] = useState("");
  const [cronExpr, setCronExpr] = useState("0 0 * * *");
  const [format, setFormat] = useState("json");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importContent, setImportContent] = useState("");
  const [lastExport, setLastExport] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["backup-jobs"],
    queryFn: async () => {
      const res = await (commands as any).listBackupJobs();
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["backup-runs"],
    queryFn: async () => {
      const res = await (commands as any).listBackupRuns(null, 20);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any[];
    },
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).createBackupJob({
        name: jobName || "Scheduled backup",
        schedule_cron: cronExpr.trim() || null,
        format,
        include_secrets: includeSecrets,
        is_active: true,
      });
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      setJobName("");
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
      notifications.show({ color: "green", message: "Backup job created." });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Backup job", message: e.message }),
  });

  const exportNow = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).exportConfiguration(
        format,
        includeSecrets,
        encryptionPassword.trim() || null,
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data as any;
    },
    onSuccess: (data) => {
      setLastExport(data.content);
      qc.invalidateQueries({ queryKey: ["backup-runs"] });
      notifications.show({ color: "green", message: `Export generated (${data.filename}).` });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Export failed", message: e.message }),
  });

  const runJob = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await (commands as any).runBackupJob(jobId, encryptionPassword.trim() || null);
      if (res.status === "error") throw new Error(res.error);
      return res.data as any;
    },
    onSuccess: (data) => {
      setLastExport(data.content);
      qc.invalidateQueries({ queryKey: ["backup-runs"] });
      notifications.show({ color: "green", message: `Backup job run complete (${data.filename}).` });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Backup run failed", message: e.message }),
  });

  const importNow = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).importConfiguration(
        {
          format: importFormat,
          content: importContent,
          is_base64: importFormat === "archive",
        },
        encryptionPassword.trim() || null,
      );
      if (res.status === "error") throw new Error(res.error);
      return res.data as string;
    },
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ["integration-configs"] });
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
      notifications.show({ color: "green", message: msg });
    },
    onError: (e: Error) => notifications.show({ color: "red", title: "Import failed", message: e.message }),
  });

  return (
    <Card withBorder>
      <Title order={4} mb="md">Backups & Import/Export</Title>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder>
            <Text fw={600} mb={8}>Scheduled Backups</Text>
            <Stack gap="sm">
              <TextInput
                label="Job name"
                placeholder="Nightly backup"
                value={jobName}
                onChange={(e) => setJobName(e.currentTarget.value)}
              />
              <TextInput
                label="Cron"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.currentTarget.value)}
                description="Use standard 5-field cron format"
              />
              <Select
                label="Format"
                value={format}
                onChange={(v) => setFormat(v || "json")}
                data={[
                  { value: "json", label: "JSON" },
                  { value: "yaml", label: "YAML" },
                  { value: "archive", label: "Archive (ZIP)" },
                ]}
              />
              <Checkbox
                label="Include secrets (API keys/tokens/passwords)"
                checked={includeSecrets}
                onChange={(e) => setIncludeSecrets(e.currentTarget.checked)}
              />
              <TextInput
                label="Encryption password (required when exporting secrets)"
                type="password"
                value={encryptionPassword}
                onChange={(e) => setEncryptionPassword(e.currentTarget.value)}
              />
              <Group>
                <Button onClick={() => createJob.mutate()} loading={createJob.isPending}>Create backup job</Button>
                <Button variant="light" onClick={() => exportNow.mutate()} loading={exportNow.isPending}>Export now</Button>
              </Group>
            </Stack>
          </Card>

          <Card withBorder>
            <Text fw={600} mb={8}>Import Configuration</Text>
            <Stack gap="sm">
              <Select
                label="Import format"
                value={importFormat}
                onChange={(v) => setImportFormat(v || "json")}
                data={[
                  { value: "json", label: "JSON" },
                  { value: "yaml", label: "YAML" },
                  { value: "archive", label: "Archive (base64 ZIP)" },
                ]}
              />
              <Textarea
                label="Import content"
                minRows={10}
                value={importContent}
                onChange={(e) => setImportContent(e.currentTarget.value)}
              />
              <Button onClick={() => importNow.mutate()} loading={importNow.isPending}>Run import</Button>
            </Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder>
          <Text fw={600} mb={8}>Backup Jobs</Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Cron</Table.Th>
                <Table.Th>Format</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job: any) => (
                <Table.Tr key={job.id}>
                  <Table.Td>{job.name}</Table.Td>
                  <Table.Td>{job.schedule_cron || "-"}</Table.Td>
                  <Table.Td>{job.format}</Table.Td>
                  <Table.Td>
                    <Button size="xs" onClick={() => runJob.mutate(job.id)} loading={runJob.isPending}>Run</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        <Card withBorder>
          <Text fw={600} mb={8}>Recent Backup Runs</Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Format</Table.Th>
                <Table.Th>Output</Table.Th>
                <Table.Th>Started</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {runs.map((run: any) => (
                <Table.Tr key={run.id}>
                  <Table.Td>{run.status}</Table.Td>
                  <Table.Td>{run.format}</Table.Td>
                  <Table.Td>{run.output_ref || "-"}</Table.Td>
                  <Table.Td>{String(run.started_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        {lastExport && (
          <Card withBorder>
            <Group justify="space-between" mb={8}>
              <Text fw={600}>Last Export Content</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  navigator.clipboard.writeText(lastExport);
                  notifications.show({ color: "green", message: "Export copied to clipboard." });
                }}
              >
                Copy
              </Button>
            </Group>
            <Textarea minRows={8} value={lastExport} readOnly />
          </Card>
        )}
      </Stack>
    </Card>
  );
}
