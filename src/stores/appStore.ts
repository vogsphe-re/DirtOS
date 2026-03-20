import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorScheme = "light" | "dark";

interface AppState {
  activeEnvironmentId: number | null;
  activeDashboardId: number | null;
  sidebarCollapsed: boolean;
  colorScheme: ColorScheme;

  setActiveEnvironmentId: (id: number | null) => void;
  setActiveDashboardId: (id: number | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleColorScheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeEnvironmentId: null,
      activeDashboardId: null,
      sidebarCollapsed: false,
      colorScheme: "dark",

      setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),
      setActiveDashboardId: (id) => set({ activeDashboardId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleColorScheme: () =>
        set((state) => ({
          colorScheme: state.colorScheme === "dark" ? "light" : "dark",
        })),
    }),
    {
      name: "dirtos-app-store",
      partialize: (state) => ({
        activeEnvironmentId: state.activeEnvironmentId,
        activeDashboardId: state.activeDashboardId,
        sidebarCollapsed: state.sidebarCollapsed,
        colorScheme: state.colorScheme,
      }),
    }
  )
);
