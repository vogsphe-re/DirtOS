import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = ColorScheme | "system";

interface AppState {
  activeEnvironmentId: number | null;
  activeDashboardId: number | null;
  sidebarCollapsed: boolean;
  colorScheme: ColorSchemePreference;

  setActiveEnvironmentId: (id: number | null) => void;
  setActiveDashboardId: (id: number | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setColorScheme: (colorScheme: ColorSchemePreference) => void;
  toggleColorScheme: (resolvedColorScheme: ColorScheme) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeEnvironmentId: null,
      activeDashboardId: null,
      sidebarCollapsed: false,
      colorScheme: "system",

      setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),
      setActiveDashboardId: (id) => set({ activeDashboardId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      toggleColorScheme: (resolvedColorScheme) =>
        set((state) => ({
          colorScheme:
            state.colorScheme === "system"
              ? resolvedColorScheme === "dark"
                ? "light"
                : "dark"
              : state.colorScheme === "dark"
                ? "light"
                : "dark",
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
