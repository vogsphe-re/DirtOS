import type { ColSpan, WidgetConfig, WidgetType } from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function w(type: WidgetType, title: string, col_span: ColSpan): WidgetConfig {
  return { id: uid(), type, title, col_span, config: {} };
}

export interface DashboardTemplate {
  key: string;
  name: string;
  description: string;
  defaultWidgets: () => WidgetConfig[];
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    key: "quick_overview",
    name: "Quick Overview",
    description: "At-a-glance summary of your garden",
    defaultWidgets: () => [
      w("plant_status_summary", "Plant Status", 4),
      w("open_issues", "Open Issues", 4),
      w("weather_current", "Weather", 4),
      w("upcoming_schedules", "Upcoming Schedules", 12),
    ],
  },
  {
    key: "detailed_monitoring",
    name: "Detailed Monitoring",
    description: "Deep dive into garden conditions",
    defaultWidgets: () => [
      w("plant_status_summary", "Plant Status", 4),
      w("sensor_readings", "Sensors", 6),
      w("soil_health", "Soil Health", 6),
      w("weather_current", "Weather", 6),
      w("recent_harvests", "Recent Harvests", 6),
      w("open_issues", "Issues", 6),
    ],
  },
  {
    key: "maintenance_tracker",
    name: "Maintenance Tracker",
    description: "Tasks, issues, and plant care",
    defaultWidgets: () => [
      w("upcoming_schedules", "Schedules", 6),
      w("open_issues", "Open Issues", 6),
      w("plant_status_summary", "Plant Status", 4),
      w("recent_journal", "Journal", 6),
    ],
  },
  {
    key: "resource_management",
    name: "Resource Management",
    description: "Harvest and soil resource tracking",
    defaultWidgets: () => [
      w("recent_harvests", "Harvests", 6),
      w("soil_health", "Soil Health", 6),
      w("recommendations", "Recommendations", 6),
      w("sensor_readings", "Sensors", 6),
    ],
  },
  {
    key: "soil_status_health",
    name: "Soil Status & Health",
    description: "Focused soil monitoring dashboard",
    defaultWidgets: () => [
      w("soil_health", "Soil Tests", 6),
      w("sensor_readings", "Sensor Readings", 6),
      w("recommendations", "Recommendations", 6),
      w("plant_status_summary", "Plants", 6),
    ],
  },
  {
    key: "sensors_climate",
    name: "Sensors & Climate",
    description: "Environmental monitoring hub",
    defaultWidgets: () => [
      w("sensor_readings", "All Sensors", 6),
      w("weather_current", "Weather", 6),
      w("soil_health", "Soil", 6),
      w("open_issues", "Issues", 6),
    ],
  },
];
