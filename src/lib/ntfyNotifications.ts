import { MessagePriority, publish } from "ntfy";
import type {
  NtfyNotificationSettings,
  NotificationEventType,
  NtfyPriorityValue,
} from "../stores/notificationSettingsStore";

interface NtfyDispatchPayload {
  eventType: NotificationEventType;
  title: string;
  body: string;
  issueId?: number;
}

const eventTagByType: Record<NotificationEventType, string> = {
  schedule_fired: "schedule",
  weather_alert: "weather",
  sensor_limit_breach: "sensor",
};

function normalizeServer(rawServer: string): string {
  const trimmed = rawServer.trim();
  if (!trimmed) return "https://ntfy.sh";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mapPriority(priority: NtfyPriorityValue): MessagePriority {
  switch (priority) {
    case 1:
      return MessagePriority.MIN;
    case 2:
      return MessagePriority.LOW;
    case 3:
      return MessagePriority.DEFAULT;
    case 4:
      return MessagePriority.HIGH;
    case 5:
      return MessagePriority.MAX;
    default:
      return MessagePriority.DEFAULT;
  }
}

function buildTags(settings: NtfyNotificationSettings, eventType: NotificationEventType): string[] {
  const parsedTags = settings.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return [eventTagByType[eventType], ...parsedTags].filter(
    (tag, index, allTags) => allTags.indexOf(tag) === index,
  );
}

function buildAuthorization(settings: NtfyNotificationSettings):
  | string
  | { username: string; password: string }
  | undefined {
  const accessToken = settings.access_token.trim();
  if (accessToken) return accessToken;

  const username = settings.username.trim();
  if (username && settings.password) {
    return {
      username,
      password: settings.password,
    };
  }

  return undefined;
}

function buildClickUrl(settings: NtfyNotificationSettings, issueId?: number): string | undefined {
  if (!settings.include_issue_link || !issueId) return undefined;
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/issues/${issueId}`;
}

export async function publishToNtfyNotification(
  settings: NtfyNotificationSettings,
  payload: NtfyDispatchPayload,
): Promise<void> {
  const topic = settings.topic.trim();
  if (!topic) return;

  const titlePrefix = settings.title_prefix.trim();
  const title = titlePrefix ? `${titlePrefix} ${payload.title}` : payload.title;

  await publish({
    topic,
    title,
    message: payload.body,
    server: normalizeServer(settings.server),
    markdown: settings.markdown,
    tags: buildTags(settings, payload.eventType),
    priority: mapPriority(settings.priority),
    clickURL: buildClickUrl(settings, payload.issueId),
    authorization: buildAuthorization(settings),
  });
}
