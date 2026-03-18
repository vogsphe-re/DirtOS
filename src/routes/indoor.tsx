import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/indoor")({
  component: () => <Outlet />,
});
