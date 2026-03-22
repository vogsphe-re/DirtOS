import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** Mirror of the Rust `Environment` model (generated types live in bindings.ts after build). */
export interface Environment {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  timezone: string | null;
  climate_zone: string | null;
  created_at: string;
  updated_at: string;
}

interface EnvironmentState {
  environment: Environment | null;
  setEnvironment: (env: Environment | null) => void;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  devtools(
    (set) => ({
      environment: null,
      setEnvironment: (env) => set({ environment: env }, undefined, "environment/setEnvironment"),
    }),
    { name: "EnvironmentStore" }
  )
);
