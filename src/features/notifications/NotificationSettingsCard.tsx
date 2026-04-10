import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBell, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { publishToNtfyNotification } from "../../lib/ntfyNotifications";
import {
  type NtfyPriorityValue,
  useNotificationSettingsStore,
} from "../../stores/notificationSettingsStore";

export function NotificationSettingsCard() {
  const internal = useNotificationSettingsStore((s) => s.internal);
  const ntfy = useNotificationSettingsStore((s) => s.ntfy);
  const setInternal = useNotificationSettingsStore((s) => s.setInternal);
  const setNtfy = useNotificationSettingsStore((s) => s.setNtfy);
  const resetNotificationSettings = useNotificationSettingsStore(
    (s) => s.resetNotificationSettings,
  );

  const [sendingTest, setSendingTest] = useState(false);

  const handlePriorityChange = (value: number | string) => {
    const numeric = typeof value === "number" ? value : parseInt(String(value), 10);
    if (!Number.isFinite(numeric)) return;

    const clamped = Math.max(1, Math.min(5, Math.round(numeric))) as NtfyPriorityValue;
    setNtfy({ priority: clamped });
  };

  const sendTestNotification = async () => {
    if (!ntfy.topic.trim()) {
      notifications.show({
        color: "orange",
        title: "ntfy topic required",
        message: "Set a topic before sending a test notification.",
      });
      return;
    }

    setSendingTest(true);
    try {
      await publishToNtfyNotification(
        {
          ...ntfy,
          enabled: true,
        },
        {
          eventType: "schedule_fired",
          title: "Notification test",
          body: "DirtOS successfully sent this test notification via ntfy.",
        },
      );

      notifications.show({
        color: "green",
        message: "Test notification sent to ntfy.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "ntfy send failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Card withBorder id="notifications-settings">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={4}>Notifications</Title>
            <Text size="sm" c="dimmed">
              Control in-app notification feed behavior and optional ntfy.sh forwarding.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge color={internal.enabled ? "green" : "gray"} variant="light">
              Internal {internal.enabled ? "on" : "off"}
            </Badge>
            <Badge color={ntfy.enabled ? "green" : "gray"} variant="light">
              ntfy {ntfy.enabled ? "on" : "off"}
            </Badge>
          </Group>
        </Group>

        <Card withBorder>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Internal notification feed</Text>
              <Switch
                checked={internal.enabled}
                onChange={(e) => setInternal({ enabled: e.currentTarget.checked })}
                label={internal.enabled ? "Enabled" : "Disabled"}
              />
            </Group>
            <Text size="xs" c="dimmed">
              These controls affect the in-app bell menu and unread counters only.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Checkbox
                label="Schedules"
                checked={internal.schedule_fired}
                onChange={(e) => setInternal({ schedule_fired: e.currentTarget.checked })}
                disabled={!internal.enabled}
              />
              <Checkbox
                label="Weather alerts"
                checked={internal.weather_alert}
                onChange={(e) => setInternal({ weather_alert: e.currentTarget.checked })}
                disabled={!internal.enabled}
              />
              <Checkbox
                label="Sensor breaches"
                checked={internal.sensor_limit_breach}
                onChange={(e) => setInternal({ sensor_limit_breach: e.currentTarget.checked })}
                disabled={!internal.enabled}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text fw={600}>ntfy integration</Text>
              <Switch
                checked={ntfy.enabled}
                onChange={(e) => setNtfy({ enabled: e.currentTarget.checked })}
                label={ntfy.enabled ? "Enabled" : "Disabled"}
              />
            </Group>
            <Text size="xs" c="dimmed">
              DirtOS sends matched events to your ntfy topic using the configured server and auth settings.
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Server URL"
                placeholder="https://ntfy.sh"
                value={ntfy.server}
                onChange={(e) => setNtfy({ server: e.currentTarget.value })}
              />
              <TextInput
                label="Topic"
                placeholder="my-garden-alerts"
                value={ntfy.topic}
                onChange={(e) => setNtfy({ topic: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <TextInput
                label="Title prefix"
                placeholder="DirtOS"
                value={ntfy.title_prefix}
                onChange={(e) => setNtfy({ title_prefix: e.currentTarget.value })}
              />
              <TextInput
                label="Tags (comma-separated)"
                placeholder="seedling,greenhouse"
                value={ntfy.tags}
                onChange={(e) => setNtfy({ tags: e.currentTarget.value })}
              />
              <NumberInput
                label="Priority"
                min={1}
                max={5}
                value={ntfy.priority}
                onChange={handlePriorityChange}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Checkbox
                label="Schedules"
                checked={ntfy.schedule_fired}
                onChange={(e) => setNtfy({ schedule_fired: e.currentTarget.checked })}
                disabled={!ntfy.enabled}
              />
              <Checkbox
                label="Weather alerts"
                checked={ntfy.weather_alert}
                onChange={(e) => setNtfy({ weather_alert: e.currentTarget.checked })}
                disabled={!ntfy.enabled}
              />
              <Checkbox
                label="Sensor breaches"
                checked={ntfy.sensor_limit_breach}
                onChange={(e) => setNtfy({ sensor_limit_breach: e.currentTarget.checked })}
                disabled={!ntfy.enabled}
              />
            </SimpleGrid>

            <Group gap="md">
              <Checkbox
                label="Render markdown"
                checked={ntfy.markdown}
                onChange={(e) => setNtfy({ markdown: e.currentTarget.checked })}
              />
              <Checkbox
                label="Include issue deep-link"
                checked={ntfy.include_issue_link}
                onChange={(e) => setNtfy({ include_issue_link: e.currentTarget.checked })}
              />
            </Group>

            <Divider />

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <PasswordInput
                label="Access token"
                placeholder="tk_..."
                description="Preferred auth method (Bearer token)"
                value={ntfy.access_token}
                onChange={(e) => setNtfy({ access_token: e.currentTarget.value })}
              />
              <TextInput
                label="Username"
                placeholder="optional"
                value={ntfy.username}
                onChange={(e) => setNtfy({ username: e.currentTarget.value })}
              />
              <PasswordInput
                label="Password"
                placeholder="optional"
                value={ntfy.password}
                onChange={(e) => setNtfy({ password: e.currentTarget.value })}
              />
            </SimpleGrid>

            <Group>
              <Button
                leftSection={<IconSend size={14} />}
                onClick={sendTestNotification}
                loading={sendingTest}
              >
                Send test
              </Button>
              <Button
                variant="subtle"
                leftSection={<IconBell size={14} />}
                onClick={resetNotificationSettings}
              >
                Reset defaults
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}
