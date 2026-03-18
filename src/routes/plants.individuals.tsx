import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/plants/individuals")({
  component: () => <Outlet />,
});
