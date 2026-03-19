import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { JournalEntry } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { JournalForm } from "./JournalForm";

interface PlantJournalTabProps {
  plantId: number;
}

export function PlantJournalTab({ plantId }: PlantJournalTabProps) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal-entries-plant", plantId],
    queryFn: async () => {
      const res = await commands.listJournalEntries(0, plantId, null, null);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  });

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          Add Entry
        </Button>
      </Group>

      {isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : entries.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="md">
          No journal entries for this plant yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {entries.map((e) => (
            <Group
              key={e.id}
              justify="space-between"
              style={{
                cursor: "pointer",
                padding: "8px 12px",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 8,
              }}
              wrap="nowrap"
              onClick={() =>
                navigate({ to: "/journal/$entryId", params: { entryId: String(e.id) } })
              }
            >
              <Stack gap={2}>
                <Text size="sm" fw={500} lineClamp={1}>
                  {e.title}
                </Text>
                {e.body && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {e.body}
                  </Text>
                )}
              </Stack>
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {new Date(e.created_at).toLocaleDateString()}
              </Text>
            </Group>
          ))}
        </Stack>
      )}

      <JournalForm
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultPlantId={plantId}
      />
    </Stack>
  );
}
