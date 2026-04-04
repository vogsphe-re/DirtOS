import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = ColorScheme | "system";
export type UnitSystem = "metric" | "imperial";

interface AppState {
  activeEnvironmentId: number | null;
  activeDashboardId: number | null;
  sidebarCollapsed: boolean;
  colorScheme: ColorSchemePreference;
  unitSystem: UnitSystem;

  setActiveEnvironmentId: (id: number | null) => void;
  setActiveDashboardId: (id: number | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setColorScheme: (colorScheme: ColorSchemePreference) => void;
  toggleColorScheme: (resolvedColorScheme: ColorScheme) => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        activeEnvironmentId: null,
        activeDashboardId: null,
        sidebarCollapsed: false,
        colorScheme: "system",
        unitSystem: "metric",

        setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }, undefined, "app/setActiveEnvironmentId"),
        setActiveDashboardId: (id) => set({ activeDashboardId: id }, undefined, "app/setActiveDashboardId"),
        setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }, undefined, "app/setSidebarCollapsed"),
        setColorScheme: (colorScheme) => set({ colorScheme }, undefined, "app/setColorScheme"),
        setUnitSystem: (unitSystem) => set({ unitSystem }, undefined, "app/setUnitSystem"),
        toggleColorScheme: (resolvedColorScheme) =>
          set(
            (state) => ({
              colorScheme:
                state.colorScheme === "system"
                  ? resolvedColorScheme === "dark"
                    ? "light"
                    : "dark"
                  : state.colorScheme === "dark"
                    ? "light"
                    : "dark",
            }),
            undefined,
            "app/toggleColorScheme"
          ),
      }),
      {
        name: "dirtos-app-store",
        partialize: (state) => ({
          activeEnvironmentId: state.activeEnvironmentId,
          activeDashboardId: state.activeDashboardId,
          sidebarCollapsed: state.sidebarCollapsed,
          colorScheme: state.colorScheme,
          unitSystem: state.unitSystem,
        }),
      }
    ),
    { name: "AppStore" }
  )
);
