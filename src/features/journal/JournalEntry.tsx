import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBug,
  IconEdit,
  IconLeaf,
  IconMapPin,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Issue, JournalEntry, Location, Plant } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { PhotoGallery } from "../../components/PhotoGallery";
import { JournalForm } from "./JournalForm";

const WEATHER_ICONS: Record<string, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  windy: "💨",
  snowy: "❄️",
  foggy: "🌫️",
  overcast: "🌥️",
};

function parseConditions(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

interface JournalEntryProps {
  entryId: number;
}

export function JournalEntryDetail({ entryId }: JournalEntryProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const {
    data: entry,
    isLoading,
    isError,
  } = useQuery<JournalEntry | null>({
    queryKey: ["journal-entry", entryId],
    queryFn: async () => {
      const res = await commands.getJournalEntry(entryId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  const { data: plant } = useQuery<Plant | null>({
    queryKey: ["plant", entry?.plant_id],
    queryFn: async () => {
      if (!entry?.plant_id) return null;
      const res = await commands.getPlant(entry.plant_id);
      if (res.status === "error") return null;
      return res.data;
    },
    enabled: !!entry?.plant_id,
  });

  const { data: location } = useQuery<Location | null>({
    queryKey: ["location", entry?.location_id],
    queryFn: async () => {
      if (!entry?.location_id) return null;
      const res = await commands.getLocation(entry.location_id);
      if (res.status === "error") return null;
      return res.data;
    },
    enabled: !!entry?.location_id,
  });

  // Linked issues for the same plant
  const { data: plantIssues = [] } = useQuery<Issue[]>({
    queryKey: ["issues", plant?.environment_id ?? null],
    queryFn: async () => {
      if (!plant?.environment_id) return [];
      const res = await commands.listIssues(plant.environment_id, null, null);
      if (res.status === "error") return [];
      return res.data.filter((iss) => iss.plant_id === entry?.plant_id);
    },
    enabled: !!entry?.plant_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.deleteJournalEntry(entryId);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({ message: "Entry deleted.", color: "orange" });
      navigate({ to: "/journal" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (isLoading)
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );

  if (isError || !entry)
    return (
      <Stack p="md">
        <Text c="red">Entry not found.</Text>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate({ to: "/journal" })}
        >
          Back to Journal
        </Button>
      </Stack>
    );

  const conditions = parseConditions(entry.conditions_json);

  return (
    <Stack p="md" gap="md" maw={820}>
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate({ to: "/journal" })}
        >
          Journal
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
            onClick={() => deleteMutation.mutate()}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Title + date */}
      <Box>
        <Title order={2}>{entry.title}</Title>
        <Text size="sm" c="dimmed">
          {new Date(entry.created_at).toLocaleString()}
          {entry.updated_at !== entry.created_at && (
            <> · edited {new Date(entry.updated_at).toLocaleString()}</>
          )}
        </Text>
      </Box>

      {/* Links */}
      <Group gap="lg" wrap="wrap">
        {plant && (
          <Group
            gap={4}
            style={{ cursor: "pointer" }}
            onClick={() =>
              navigate({
                to: "/plants/individuals/$plantId",
                params: { plantId: String(plant.id) },
              })
            }
          >
            <IconLeaf size={14} />
            <Text size="sm" fw={500} style={{ textDecoration: "underline" }}>
              {plant.name}
            </Text>
          </Group>
        )}
        {location && (
          <Group gap={4}>
            <IconMapPin size={14} />
            <Text size="sm">{location.name}</Text>
          </Group>
        )}
      </Group>

      {/* Conditions */}
      {Object.keys(conditions).length > 0 && (
        <Card withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed" fw={600} mb={6}>
            Conditions
          </Text>
          <Group gap="sm" wrap="wrap">
            {!!conditions.weather && (
              <Badge variant="light" color="blue">
                {WEATHER_ICONS[conditions.weather as string] ?? ""}{" "}
                {String(conditions.weather)}
              </Badge>
            )}
            {!!conditions.plant_health && (
              <Badge
                variant="light"
                color={
                  conditions.plant_health === "healthy"
                    ? "green"
                    : conditions.plant_health === "fair"
                    ? "yellow"
                    : conditions.plant_health === "poor"
                    ? "orange"
                    : "red"
                }
              >
                🌱 {String(conditions.plant_health)}
              </Badge>
            )}
            {conditions.temperature_c != null && (
              <Badge variant="outline" color="gray">
                🌡️ {String(conditions.temperature_c)}°C
              </Badge>
            )}
            {conditions.humidity_pct != null && (
              <Badge variant="outline" color="gray">
                💧 {String(conditions.humidity_pct)}% humidity
              </Badge>
            )}
            {conditions.soil_moisture != null && (
              <Badge variant="outline" color="gray">
                🌍 {String(conditions.soil_moisture)}% soil moisture
              </Badge>
            )}
          </Group>
        </Card>
      )}

      {/* Body */}
      {entry.body && (
        <Box>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Notes
          </Text>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {entry.body}
          </Text>
        </Box>
      )}

      <Divider />

      {/* Photos */}
      <Box>
        <Text size="sm" fw={600} mb="xs">
          Photos
        </Text>
        <PhotoGallery entityType="journal_entry" entityId={entryId} />
      </Box>

      {/* Linked Issues */}
      {plantIssues.length > 0 && (
        <>
          <Divider />
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Issues on this plant
            </Text>
            <Stack gap="xs">
              {plantIssues.slice(0, 5).map((iss) => (
                <Group
                  key={iss.id}
                  gap={8}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate({
                      to: "/issues/$issueId",
                      params: { issueId: String(iss.id) },
                    })
                  }
                >
                  <IconBug size={14} />
                  <Text size="sm" style={{ textDecoration: "underline" }}>
                    #{iss.id} {iss.title}
                  </Text>
                  <Badge size="xs" variant="light">
                    {iss.status}
                  </Badge>
                </Group>
              ))}
            </Stack>

            {/* Quick "create issue from entry" shortcut */}
            <Button
              mt="sm"
              size="xs"
              variant="subtle"
              leftSection={<IconBug size={14} />}
              onClick={() =>
                navigate({
                  to: "/issues",
                  search: {
                    createFromJournal: String(entryId),
                    createTitle: entry.title,
                    createDesc: entry.body ?? "",
                    createPlantId: entry.plant_id ? String(entry.plant_id) : undefined,
                  },
                })
              }
            >
              Create issue from this entry
            </Button>
          </Box>
        </>
      )}

      <JournalForm opened={editOpen} onClose={() => setEditOpen(false)} existing={entry} />
    </Stack>
  );
}
