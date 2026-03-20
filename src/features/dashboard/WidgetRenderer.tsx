/**
 * WidgetRenderer — dispatches a WidgetConfig to the matching component.
 * Lives in its own file so fast-refresh only sees React components here.
 */
import type { WidgetConfig } from "./types";
import {
  OpenIssuesWidget,
  PlantStatusWidget,
  RecentHarvestsWidget,
  RecentJournalWidget,
  RecommendationsWidget,
  SensorReadingsWidget,
  SoilHealthWidget,
  UpcomingSchedulesWidget,
  WeatherWidget,
  EmptyState,
} from "./widgets";

export function WidgetRenderer({
  config,
  envId,
}: {
  config: WidgetConfig;
  envId: number;
}) {
  switch (config.type) {
    case "plant_status_summary":
      return <PlantStatusWidget envId={envId} />;
    case "open_issues":
      return <OpenIssuesWidget envId={envId} />;
    case "upcoming_schedules":
      return <UpcomingSchedulesWidget envId={envId} />;
    case "weather_current":
      return <WeatherWidget envId={envId} />;
    case "sensor_readings":
      return <SensorReadingsWidget envId={envId} />;
    case "soil_health":
      return <SoilHealthWidget envId={envId} />;
    case "recent_harvests":
      return <RecentHarvestsWidget envId={envId} />;
    case "recommendations":
      return <RecommendationsWidget envId={envId} />;
    case "recent_journal":
      return <RecentJournalWidget envId={envId} />;
    default:
      return <EmptyState msg="Unknown widget type." />;
  }
}
