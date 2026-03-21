import { Box, Button, Center, Group, Loader, Skeleton, Stack, Text, Title } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";

export function AppSplash({ title, message }: { title: string; message: string }) {
  return (
    <Center mih="100vh" p="xl">
      <Stack className="dirtos-glass" maw={560} w="100%" p="xl" gap="lg">
        <Stack gap={6}>
          <Text fw={700} tt="uppercase" c="dimmed" size="sm">
            DirtOS
          </Text>
          <Title order={1}>{title}</Title>
          <Text c="dimmed">{message}</Text>
        </Stack>
        <Group align="center" gap="sm">
          <Loader color="green" />
          <Text size="sm" c="dimmed">
            Preparing your workspace
          </Text>
        </Group>
      </Stack>
    </Center>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <Group justify="center" p="xl">
      <Loader size="sm" />
      <Text c="dimmed">{label}</Text>
    </Group>
  );
}

export function PanelSkeleton() {
  return (
    <Stack gap="sm">
      <Skeleton height={18} width="22%" radius="xl" />
      <Skeleton height={52} radius="md" />
      <Skeleton height={52} radius="md" />
      <Skeleton height={180} radius="md" />
    </Stack>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Stack className="dirtos-glass" gap="sm" p="lg">
      <Title order={4}>{title}</Title>
      <Text c="dimmed">{message}</Text>
      {actionLabel && onAction && (
        <Box>
          <Button variant="light" onClick={onAction}>
            {actionLabel}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Stack className="dirtos-glass" gap="sm" p="lg">
      <Title order={4}>{title}</Title>
      <Text c="dimmed">{message}</Text>
      {onRetry && (
        <Box>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={onRetry}>
            Retry
          </Button>
        </Box>
      )}
    </Stack>
  );
}
