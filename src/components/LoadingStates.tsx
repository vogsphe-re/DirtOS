import { Box, Button, Group, Loader, Skeleton, Stack, Text, Title } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import splashUrl from "../../assets/splash.png";

export function AppSplash({ message }: { title?: string; message: string }) {
  return (
    <Box
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--mantine-color-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack align="center" gap="xl" style={{ width: "min(380px, 90vw)" }}>
        <img
          src={splashUrl}
          alt=""
          style={{ width: "100%", height: "auto" }}
        />
        <Stack gap={6} style={{ width: "100%" }}>
          <div className="dirtos-splash-progress" aria-label="Loading" />
          <Text size="xs" c="dimmed" ta="center">
            {message}
          </Text>
        </Stack>
      </Stack>
    </Box>
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
