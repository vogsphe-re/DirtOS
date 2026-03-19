import { create } from "zustand";

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

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: `${Date.now()}-${Math.random()}`,
          read: false,
          created_at: new Date().toISOString(),
        },
        ...s.notifications,
      ].slice(0, 50), // Keep last 50
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
