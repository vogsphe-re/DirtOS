/**
 * Unit conversion helpers and a hook to access the active unit system.
 * Metric is the internal storage / API format throughout DirtOS.
 * All display conversions happen here.
 */
import { useAppStore, type UnitSystem } from "../stores/appStore";

// ---------------------------------------------------------------------------
// Pure conversion functions
// ---------------------------------------------------------------------------

export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

export function metersPerSecondToMph(ms: number): number {
  return ms * 2.23694;
}

export function metersPerSecondToKmh(ms: number): number {
  return ms * 3.6;
}

export function mmToInches(mm: number): number {
  return mm / 25.4;
}

export function metersToFeet(m: number): number {
  return m * 3.28084;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

// ---------------------------------------------------------------------------
// Formatter factories — use these in components
// ---------------------------------------------------------------------------

export interface UnitFormatters {
  /** "°C" or "°F" */
  tempUnit: string;
  /** Format a temperature value (stored as °C) */
  temp(c: number): string;
  /** Short temp with unit, e.g. "23°C" or "73°F" */
  tempShort(c: number): string;
  /** Wind speed label: "m/s", "mph", or "km/h" */
  windUnit: string;
  /** Format wind speed (stored as m/s) */
  wind(ms: number): string;
  /** Format precipitation (stored as mm) */
  precip(mm: number): string;
  /** Precipitation unit label: "mm" or "in" */
  precipUnit: string;
  /** Format visibility (stored as metres) */
  visibility(m: number): string;
  /** Format elevation (stored as metres) */
  elevation(m: number): string;
}

export function buildFormatters(system: UnitSystem): UnitFormatters {
  if (system === "imperial") {
    return {
      tempUnit: "°F",
      temp: (c) => `${Math.round(celsiusToFahrenheit(c))}°F`,
      tempShort: (c) => `${Math.round(celsiusToFahrenheit(c))}°`,
      windUnit: "mph",
      wind: (ms) => `${metersPerSecondToMph(ms).toFixed(1)} mph`,
      precip: (mm) => `${mmToInches(mm).toFixed(2)} in`,
      precipUnit: "in",
      visibility: (m) => {
        const mi = kmToMiles(m / 1000);
        return mi >= 1 ? `${mi.toFixed(1)} mi` : `${Math.round(m * 3.28084)} ft`;
      },
      elevation: (m) => `${Math.round(metersToFeet(m))} ft`,
    };
  }
  return {
    tempUnit: "°C",
    temp: (c) => `${Math.round(c)}°C`,
    tempShort: (c) => `${Math.round(c)}°`,
    windUnit: "m/s",
    wind: (ms) => `${ms.toFixed(1)} m/s`,
    precip: (mm) => `${mm.toFixed(1)} mm`,
    precipUnit: "mm",
    visibility: (m) =>
      m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`,
    elevation: (m) => `${Math.round(m)} m`,
  };
}

// ---------------------------------------------------------------------------
// React hook — reads from persisted appStore
// ---------------------------------------------------------------------------

export function useUnits(): UnitFormatters {
  const system = useAppStore((s) => s.unitSystem);
  return buildFormatters(system);
}
