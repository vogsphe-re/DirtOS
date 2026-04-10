import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type NotificationEventType =
  | "schedule_fired"
  | "weather_alert"
  | "sensor_limit_breach";

export type NtfyPriorityValue = 1 | 2 | 3 | 4 | 5;

export interface InternalNotificationSettings {
  enabled: boolean;
  schedule_fired: boolean;
  weather_alert: boolean;
  sensor_limit_breach: boolean;
}

export interface NtfyNotificationSettings {
  enabled: boolean;
  server: string;
  topic: string;
  access_token: string;
  username: string;
  password: string;
  priority: NtfyPriorityValue;
  tags: string;
  title_prefix: string;
  markdown: boolean;
  include_issue_link: boolean;
  schedule_fired: boolean;
  weather_alert: boolean;
  sensor_limit_breach: boolean;
}

interface NotificationSettingsState {
  internal: InternalNotificationSettings;
  ntfy: NtfyNotificationSettings;
  setInternal: (patch: Partial<InternalNotificationSettings>) => void;
  setNtfy: (patch: Partial<NtfyNotificationSettings>) => void;
  resetNotificationSettings: () => void;
}

const defaultInternalSettings: InternalNotificationSettings = {
  enabled: true,
  schedule_fired: true,
  weather_alert: true,
  sensor_limit_breach: true,
};

const defaultNtfySettings: NtfyNotificationSettings = {
  enabled: false,
  server: "https://ntfy.sh",
  topic: "",
  access_token: "",
  username: "",
  password: "",
  priority: 3,
  tags: "seedling",
  title_prefix: "DirtOS",
  markdown: false,
  include_issue_link: true,
  schedule_fired: true,
  weather_alert: true,
  sensor_limit_breach: true,
};

export function isInternalNotificationEnabledForEvent(
  settings: InternalNotificationSettings,
  eventType: NotificationEventType,
): boolean {
  if (!settings.enabled) return false;

  switch (eventType) {
    case "schedule_fired":
      return settings.schedule_fired;
    case "weather_alert":
      return settings.weather_alert;
    case "sensor_limit_breach":
      return settings.sensor_limit_breach;
    default:
      return false;
  }
}

export function isNtfyNotificationEnabledForEvent(
  settings: NtfyNotificationSettings,
  eventType: NotificationEventType,
): boolean {
  if (!settings.enabled) return false;

  switch (eventType) {
    case "schedule_fired":
      return settings.schedule_fired;
    case "weather_alert":
      return settings.weather_alert;
    case "sensor_limit_breach":
      return settings.sensor_limit_breach;
    default:
      return false;
  }
}

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
  devtools(
    persist(
      (set) => ({
        internal: defaultInternalSettings,
        ntfy: defaultNtfySettings,
        setInternal: (patch) =>
          set(
            (state) => ({
              internal: {
                ...state.internal,
                ...patch,
              },
            }),
            undefined,
            "notificationSettings/setInternal",
          ),
        setNtfy: (patch) =>
          set(
            (state) => ({
              ntfy: {
                ...state.ntfy,
                ...patch,
              },
            }),
            undefined,
            "notificationSettings/setNtfy",
          ),
        resetNotificationSettings: () =>
          set(
            {
              internal: defaultInternalSettings,
              ntfy: defaultNtfySettings,
            },
            undefined,
            "notificationSettings/reset",
          ),
      }),
      {
        name: "dirtos-notification-settings",
        partialize: (state) => ({
          internal: state.internal,
          ntfy: state.ntfy,
        }),
      },
    ),
    { name: "NotificationSettingsStore" },
  ),
);
