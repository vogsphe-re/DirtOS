/**
 * weatherStore – shared cache of the latest weather data.
 * Other features (garden, indoor, schedules, dashboard) can read from this
 * store without making their own API calls.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WeatherAlertSettings, WeatherData } from "../lib/bindings";

interface WeatherState {
  weather: WeatherData | null;
  alertSettings: WeatherAlertSettings | null;
  lastFetchedEnvId: number | null;

  setWeather: (data: WeatherData | null, envId: number | null) => void;
  setAlertSettings: (s: WeatherAlertSettings) => void;

  // Convenience selectors
  currentTempC: () => number | null;
  todayHighC: () => number | null;
  todayLowC: () => number | null;
  precipProbToday: () => number | null;
  windSpeedMs: () => number | null;
}

export const useWeatherStore = create<WeatherState>()(
  devtools(
    (set, get) => ({
      weather: null,
      alertSettings: null,
      lastFetchedEnvId: null,

      setWeather: (data, envId) =>
        set({ weather: data, lastFetchedEnvId: envId }, undefined, "weather/setWeather"),

      setAlertSettings: (s) =>
        set({ alertSettings: s }, undefined, "weather/setAlertSettings"),

      currentTempC: () => get().weather?.current.temperature_c ?? null,

      todayHighC: () => get().weather?.daily[0]?.temp_max_c ?? null,

      todayLowC: () => get().weather?.daily[0]?.temp_min_c ?? null,

      precipProbToday: () => get().weather?.daily[0]?.precipitation_prob ?? null,

      windSpeedMs: () => get().weather?.current.wind_speed_ms ?? null,
    }),
    { name: "WeatherStore" }
  )
);
