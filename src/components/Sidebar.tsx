import { NavLink, ScrollArea, Stack, Tooltip, Box } from "@mantine/core";
import {
  IconLayoutDashboard,
  IconMap2,
  IconLeaf,
  IconBug,
  IconNotebook,
  IconCalendar,
  IconCloud,
  IconWifi,
  IconBuildingFactory2,
  IconChartBar,
  IconSettings,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "@tanstack/react-router";

const NAV_ITEMS = [
  { label: "Dashboard", icon: IconLayoutDashboard, to: "/" as const },
  { label: "Garden", icon: IconMap2, to: "/garden" as const },
  { label: "Plants", icon: IconLeaf, to: "/plants" as const },
  { label: "Issues", icon: IconBug, to: "/issues" as const },
  { label: "Journal", icon: IconNotebook, to: "/journal" as const },
  { label: "Schedules", icon: IconCalendar, to: "/schedules" as const },
  { label: "Weather", icon: IconCloud, to: "/weather" as const },
  { label: "Sensors", icon: IconWifi, to: "/sensors" as const },
  { label: "Indoor", icon: IconBuildingFactory2, to: "/indoor" as const },
  { label: "Reports", icon: IconChartBar, to: "/reports" as const },
];

const SETTINGS_ITEM = {
  label: "Settings",
  icon: IconSettings,
  to: "/settings" as const,
};

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <Stack gap={0} h="100%">
      <ScrollArea flex={1} type="never">
        <Box py={4}>
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </Box>
      </ScrollArea>
      <Box
        py={4}
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
      >
        <SidebarItem item={SETTINGS_ITEM} collapsed={collapsed} />
      </Box>
    </Stack>
  );
}

type NavItem = { label: string; icon: React.ComponentType<{ size?: number }>; to: string };

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive =
    item.to === "/"
      ? location.pathname === "/"
      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  const Icon = item.icon;

  const navLink = (
    <NavLink
      label={collapsed ? undefined : item.label}
      leftSection={<Icon size={18} />}
      active={isActive}
      onClick={() => navigate({ to: item.to })}
      styles={{
        root: { borderRadius: 6, margin: "1px 4px" },
        label: { fontSize: "var(--mantine-font-size-sm)" },
      }}
    />
  );

  if (collapsed) {
    return (
      <Tooltip label={item.label} position="right" offset={8} withArrow>
        <Box>{navLink}</Box>
      </Tooltip>
    );
  }

  return navLink;
}
