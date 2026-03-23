import { Anchor, Badge, Card, Group, List, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import pkg from "../../package.json";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <Stack p="md" maw={820} gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>About DirtOS</Title>
          <Text c="dimmed">
            DirtOS is a local-first garden operations workspace for planning, monitoring, scheduling, and documenting the full lifecycle of your growing environments.
          </Text>
        </Stack>
        <Badge size="lg" variant="light" color="blue-outline">
          v{pkg.version}
        </Badge>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Platform</Title>
          <List spacing="xs">
            <List.Item>Frontend: React, Mantine, TanStack Router, React Query</List.Item>
            <List.Item>Desktop runtime: Tauri 2</List.Item>
            <List.Item>Storage: SQLite with local media assets in the application data directory</List.Item>
          </List>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Release Notes</Title>
          <Text>
            This polish release adds system-aware theming, startup readiness handling, recovery-oriented backups, stronger empty and loading states, and release packaging refinements.
          </Text>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Documentation</Title>
          <Text>
            See the repository guides for onboarding, architecture, and workflows.
          </Text>
          <Group gap="md">
            <Anchor href="https://tauri.app" target="_blank" rel="noreferrer">
              Tauri
            </Anchor>
            <Anchor href="https://mantine.dev" target="_blank" rel="noreferrer">
              Mantine
            </Anchor>
            <Anchor href="https://tanstack.com/router/latest" target="_blank" rel="noreferrer">
              TanStack Router
            </Anchor>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
