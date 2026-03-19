import { createFileRoute } from "@tanstack/react-router";
import { Tabs } from "@mantine/core";
import { IconCalendar, IconList } from "@tabler/icons-react";
import { ScheduleList } from "../features/schedules/ScheduleList";
import { CalendarView } from "../features/schedules/CalendarView";

export const Route = createFileRoute("/schedules/")({
  component: SchedulesPage,
});

function SchedulesPage() {
  return (
    <Tabs defaultValue="list" keepMounted={false}>
      <Tabs.List px="md" pt="sm">
        <Tabs.Tab value="list" leftSection={<IconList size={14} />}>
          Schedules
        </Tabs.Tab>
        <Tabs.Tab value="calendar" leftSection={<IconCalendar size={14} />}>
          Calendar
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="list">
        <ScheduleList />
      </Tabs.Panel>

      <Tabs.Panel value="calendar">
        <CalendarView />
      </Tabs.Panel>
    </Tabs>
  );
}
