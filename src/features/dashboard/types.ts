// Dashboard widget type identifiers
export type WidgetType =
  | "plant_status_summary"
  | "open_issues"
  | "upcoming_schedules"
  | "weather_current"
  | "sensor_readings"
  | "soil_health"
  | "recent_harvests"
  | "recommendations"
  | "recent_journal"
  | "ha_iframe";

// Supported column spans (12-column grid)
export type ColSpan = 4 | 6 | 12;

// Stored per-widget configuration (serialised to JSON in SQLite)
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  col_span: ColSpan;
  config: Record<string, unknown>;
}

// Widget catalogue entry
export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  defaultSpan: ColSpan;
}

export const WIDGET_CATALOGUE: WidgetMeta[] = [
  {
    type: "plant_status_summary",
    label: "Plant Status",
    description: "Counts of plants by lifecycle status",
    defaultSpan: 4,
  },
  {
    type: "open_issues",
    label: "Open Issues",
    description: "Active issues and alerts",
    defaultSpan: 4,
  },
  {
    type: "upcoming_schedules",
    label: "Upcoming Schedules",
    description: "Tasks due in the next 7 days",
    defaultSpan: 4,
  },
  {
    type: "weather_current",
    label: "Weather",
    description: "Current conditions and forecast",
    defaultSpan: 4,
  },
  {
    type: "sensor_readings",
    label: "Sensor Readings",
    description: "Latest readings from all sensors",
    defaultSpan: 6,
  },
  {
    type: "soil_health",
    label: "Soil Health",
    description: "Recent soil test pH and nutrients",
    defaultSpan: 6,
  },
  {
    type: "recent_harvests",
    label: "Recent Harvests",
    description: "Last 5 harvest records",
    defaultSpan: 6,
  },
  {
    type: "recommendations",
    label: "Recommendations",
    description: "Automated care suggestions",
    defaultSpan: 6,
  },
  {
    type: "recent_journal",
    label: "Journal",
    description: "Latest journal entries",
    defaultSpan: 4,
  },
  {
    type: "ha_iframe",
    label: "Home Assistant Dashboard",
    description: "Embed a Home Assistant dashboard or panel via its URL",
    defaultSpan: 12,
  },
];
