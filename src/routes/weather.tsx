import { createFileRoute } from "@tanstack/react-router";
import { WeatherDashboard } from "../features/weather/WeatherDashboard";

export const Route = createFileRoute("/weather")({
  component: WeatherDashboard,
});
