import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconBell, IconBellOff, IconCheck } from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNotificationStore } from "../stores/notificationStore";

interface ScheduleFiredPayload {
  schedule_id: number;
  schedule_title: string;
  issue_id: number;
  issue_title: string;
}

interface WeatherAlertPayload {
  issue_id: number;
  title: string;
  body: string;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, addNotification, markRead, markAllRead, dismiss } =
    useNotificationStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Listen for schedule:fired events from the Rust backend
  useEffect(() => {
    const unlisten = listen<ScheduleFiredPayload>("schedule:fired", (event) => {
      const { schedule_title, issue_id, issue_title, schedule_id } = event.payload;
      addNotification({
        title: schedule_title,
        body: `Issue created: ${issue_title}`,
        issue_id,
        schedule_id,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); // eslint-disable-line

  // Listen for weather:alert events from the Rust backend
  useEffect(() => {
    const unlisten = listen<WeatherAlertPayload>("weather:alert", (event) => {
      const { issue_id, title, body } = event.payload;
      addNotification({
        title: `⚠️ ${title}`,
        body,
        issue_id,
        schedule_id: undefined,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); // eslint-disable-line

  return (
    <Popover width={340} position="bottom-end" shadow="md" withArrow>
      <Popover.Target>
        <Tooltip label="Notifications">
          <Indicator
            label={unreadCount > 0 ? String(unreadCount) : undefined}
            size={16}
            color="red"
            disabled={unreadCount === 0}
          >
            <ActionIcon
              variant="subtle"
              size="md"
              aria-label="Notifications"
            >
              <IconBell size={18} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Header */}
        <Group justify="space-between" p="sm" pb={0}>
          <Text fw={600} size="sm">
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconCheck size={12} />}
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </Group>

        <ScrollArea.Autosize mah={360} type="scroll">
          {notifications.length === 0 ? (
            <Stack align="center" p="xl" gap={4}>
              <IconBellOff size={32} opacity={0.3} />
              <Text size="xs" c="dimmed">
                No notifications
              </Text>
            </Stack>
          ) : (
            <Stack gap={0} mt={4}>
              {notifications.map((n) => (
                <Box
                  key={n.id}
                  px="sm"
                  py={8}
                  style={{
                    cursor: n.issue_id ? "pointer" : "default",
                    background: n.read
                      ? undefined
                      : "var(--mantine-color-blue-light)",
                    borderBottom:
                      "1px solid var(--mantine-color-default-border)",
                  }}
                  onClick={() => {
                    markRead(n.id);
                    if (n.issue_id) {
                      navigate({
                        to: "/issues/$issueId",
                        params: { issueId: String(n.issue_id) },
                      });
                    }
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={4} mb={2}>
                        {!n.read && (
                          <Badge size="xs" color="blue" variant="filled" p={4}>
                            New
                          </Badge>
                        )}
                        <Text size="xs" fw={600} lineClamp={1}>
                          {n.title}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {n.body}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {new Date(n.created_at).toLocaleTimeString()}
                      </Text>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      aria-label="Dismiss"
                    >
                      ×
                    </ActionIcon>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
