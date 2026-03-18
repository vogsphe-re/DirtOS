import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/plants")({
  component: () => <Outlet />,
});
