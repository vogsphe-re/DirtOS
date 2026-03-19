import {
  Badge,
  Box,
  Button,
  Checkbox,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CalendarEvent, CalendarEventType } from "../../lib/bindings";
import { commands } from "../../lib/bindings";
import { useAppStore } from "../../stores/appStore";

const TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; color: string; defaultVisible: boolean }
> = {
  Schedule: { label: "Schedules", color: "#228be6", defaultVisible: true },
  PlantingDate: { label: "Planted", color: "#2d6a4f", defaultVisible: true },
  HarvestDate: { label: "Harvested", color: "#e76f51", defaultVisible: true },
  IssueCreated: { label: "Issues", color: "#e63946", defaultVisible: false },
};

const ALL_EVENT_TYPES = Object.keys(TYPE_CONFIG) as CalendarEventType[];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of month
  return {
    startStr: formatDate(start),
    endStr: formatDate(end),
  };
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarView() {
  const activeEnvId = useAppStore((s) => s.activeEnvironmentId);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<CalendarEventType>>(
    new Set(ALL_EVENT_TYPES.filter((t) => TYPE_CONFIG[t].defaultVisible))
  );

  const { startStr, endStr } = getMonthRange(year, month);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", activeEnvId, startStr, endStr],
    queryFn: async () => {
      if (!activeEnvId) return [];
      const res = await commands.getCalendarEvents(activeEnvId, startStr, endStr);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!activeEnvId,
  });

  const filteredEvents = useMemo(
    () => events.filter((e) => visibleTypes.has(e.event_type)),
    [events, visibleTypes]
  );

  // Build a map: "YYYY-MM-DD" → events[]
  const eventsByDay = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const e of filteredEvents) {
      (m[e.date] ??= []).push(e);
    }
    return m;
  }, [filteredEvents]);

  // Calendar grid: days in month padded to start on the right weekday
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells: (Date | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const selectedDayEvents = selectedDay
    ? (eventsByDay[formatDate(selectedDay)] ?? [])
    : [];

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  function toggleType(t: CalendarEventType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  const monthLabel = new Date(year, month, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <Stack p="md" gap="md">
      {/* Header */}
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Calendar</Title>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconChevronLeft size={14} />}
            onClick={prevMonth}
          >
            Prev
          </Button>
          <Text fw={600} size="sm" w={160} ta="center">
            {monthLabel}
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconChevronRight size={14} />}
            onClick={nextMonth}
          >
            Next
          </Button>
        </Group>
      </Group>

      {/* Legend / Filters */}
      <Group gap="sm" wrap="wrap">
        {ALL_EVENT_TYPES.map((t) => (
          <Checkbox
            key={t}
            label={
              <Group gap={4}>
                <Box
                  w={10}
                  h={10}
                  style={{ borderRadius: 2, background: TYPE_CONFIG[t].color }}
                />
                <Text size="xs">{TYPE_CONFIG[t].label}</Text>
              </Group>
            }
            checked={visibleTypes.has(t)}
            onChange={() => toggleType(t)}
            size="xs"
          />
        ))}
      </Group>

      {!activeEnvId ? (
        <Text c="dimmed" ta="center" py="xl">
          Select an environment to view calendar.
        </Text>
      ) : (
        <Grid columns={7} gutter={0}>
          {/* Side panel + calendar layout */}
          <Grid.Col span={selectedDay ? 5 : 7}>
            <Stack gap={0}>
              {/* Weekday headers */}
              <SimpleGrid cols={7} spacing={0}>
                {WEEKDAYS.map((d) => (
                  <Box
                    key={d}
                    p={4}
                    style={{
                      textAlign: "center",
                      borderBottom: "1px solid var(--mantine-color-default-border)",
                    }}
                  >
                    <Text size="xs" c="dimmed" fw={600}>
                      {d}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>

              {/* Calendar days */}
              {isLoading ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                </Group>
              ) : (
                <SimpleGrid cols={7} spacing={0}>
                  {calendarCells.map((date, idx) => {
                    if (!date) {
                      return (
                        <Box
                          key={`empty-${idx}`}
                          style={{
                            minHeight: 72,
                            borderRight: "1px solid var(--mantine-color-default-border)",
                            borderBottom: "1px solid var(--mantine-color-default-border)",
                            background: "var(--mantine-color-default-hover)",
                          }}
                        />
                      );
                    }
                    const dateStr = formatDate(date);
                    const dayEvents = eventsByDay[dateStr] ?? [];
                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDay && isSameDay(date, selectedDay);

                    return (
                      <Box
                        key={dateStr}
                        p={4}
                        style={{
                          minHeight: 72,
                          borderRight: "1px solid var(--mantine-color-default-border)",
                          borderBottom: "1px solid var(--mantine-color-default-border)",
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--mantine-color-blue-light)"
                            : undefined,
                        }}
                        onClick={() =>
                          setSelectedDay(
                            isSelected ? null : date
                          )
                        }
                      >
                        <Text
                          size="xs"
                          fw={isToday ? 700 : undefined}
                          c={isToday ? "blue" : undefined}
                          mb={4}
                          style={
                            isToday
                              ? {
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: "var(--mantine-color-blue-6)",
                                  color: "white",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }
                              : undefined
                          }
                        >
                          {date.getDate()}
                        </Text>
                        <Stack gap={2}>
                          {dayEvents.slice(0, 3).map((e) => (
                            <Box
                              key={e.id}
                              px={4}
                              py={1}
                              style={{
                                borderRadius: 3,
                                background: e.color ?? "#adb5bd",
                                overflow: "hidden",
                              }}
                            >
                              <Text size="xs" c="white" lineClamp={1} style={{ fontSize: 10 }}>
                                {e.title}
                              </Text>
                            </Box>
                          ))}
                          {dayEvents.length > 3 && (
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                              +{dayEvents.length - 3} more
                            </Text>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Grid.Col>

          {/* Side panel for selected day */}
          {selectedDay && (
            <Grid.Col span={2}>
              <Paper
                withBorder
                p="sm"
                ml="xs"
                h="100%"
                style={{ minHeight: 200 }}
              >
                <Text fw={600} size="sm" mb="xs">
                  {selectedDay.toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <ScrollArea.Autosize mah={400}>
                  {selectedDayEvents.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      No events
                    </Text>
                  ) : (
                    <Stack gap={4}>
                      {selectedDayEvents.map((e) => (
                        <Box
                          key={e.id}
                          p={6}
                          style={{
                            borderRadius: 4,
                            borderLeft: `3px solid ${e.color ?? "#adb5bd"}`,
                            background: "var(--mantine-color-default-hover)",
                          }}
                        >
                          <Badge
                            size="xs"
                            color="gray"
                            variant="outline"
                            mb={2}
                          >
                            {e.event_type}
                          </Badge>
                          <Text size="xs" fw={500}>
                            {e.title}
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </ScrollArea.Autosize>
              </Paper>
            </Grid.Col>
          )}
        </Grid>
      )}
    </Stack>
  );
}
