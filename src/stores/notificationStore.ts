import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  issue_id?: number;
  schedule_id?: number;
  read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, "id" | "read" | "created_at">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      notifications: [],
      addNotification: (n) =>
        set(
          (s) => ({
            notifications: [
              {
                ...n,
                id: `${Date.now()}-${Math.random()}`,
                read: false,
                created_at: new Date().toISOString(),
              },
              ...s.notifications,
            ].slice(0, 50), // Keep last 50
          }),
          undefined,
          "notifications/add"
        ),
      markRead: (id) =>
        set(
          (s) => ({
            notifications: s.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }),
          undefined,
          "notifications/markRead"
        ),
      markAllRead: () =>
        set(
          (s) => ({
            notifications: s.notifications.map((n) => ({ ...n, read: true })),
          }),
          undefined,
          "notifications/markAllRead"
        ),
      dismiss: (id) =>
        set(
          (s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }),
          undefined,
          "notifications/dismiss"
        ),
    }),
    { name: "NotificationStore" }
  )
);
