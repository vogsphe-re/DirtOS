import { commands, type Schedule, type ScheduleType } from "../../lib/bindings";

type UpsertReminderInput = {
  environmentId: number;
  locationId: number;
  reminderKey: string;
  title: string;
  scheduleType: ScheduleType;
  cronExpression: string;
  notes: string;
};

const REMINDER_KEY_PATTERN = /<!--\s*dirtos:reminder-key=([^>\s]+)\s*-->/i;

function extractReminderKey(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(REMINDER_KEY_PATTERN);
  return m?.[1] ?? null;
}

function withReminderKey(notes: string, reminderKey: string): string {
  const marker = `<!-- dirtos:reminder-key=${reminderKey} -->`;
  if (REMINDER_KEY_PATTERN.test(notes)) {
    return notes.replace(REMINDER_KEY_PATTERN, marker);
  }
  return `${notes.trim()}\n${marker}`.trim();
}

function matchesReminder(schedule: Schedule, locationId: number, title: string): boolean {
  if (schedule.location_id !== locationId) return false;
  return schedule.title.trim().toLowerCase() === title.trim().toLowerCase();
}

export async function upsertLocationReminder(input: UpsertReminderInput): Promise<Schedule> {
  const listRes = await commands.listSchedules(input.environmentId);
  if (listRes.status === "error") throw new Error(listRes.error);

  const existingByKey = listRes.data.find(
    (s) =>
      s.location_id === input.locationId &&
      extractReminderKey(s.notes) === input.reminderKey,
  );
  const existingByLegacyTitle = listRes.data.find((s) =>
    matchesReminder(s, input.locationId, input.title),
  );
  const existing = existingByKey ?? existingByLegacyTitle;

  const notesWithKey = withReminderKey(input.notes, input.reminderKey);

  if (existing) {
    const updateRes = await commands.updateSchedule(existing.id, {
      schedule_type: input.scheduleType,
      title: input.title,
      cron_expression: input.cronExpression,
      is_active: true,
      plant_id: null,
      location_id: input.locationId,
      additive_id: null,
      notes: notesWithKey,
    });
    if (updateRes.status === "error") throw new Error(updateRes.error);
    if (!updateRes.data) throw new Error("Failed to update existing reminder schedule");
    return updateRes.data;
  }

  const createRes = await commands.createSchedule({
    environment_id: input.environmentId,
    plant_id: null,
    location_id: input.locationId,
    schedule_type: input.scheduleType,
    title: input.title,
    cron_expression: input.cronExpression,
    next_run_at: null,
    is_active: true,
    additive_id: null,
    notes: notesWithKey,
  });
  if (createRes.status === "error") throw new Error(createRes.error);
  return createRes.data;
}

export async function listLocationReminders(
  environmentId: number,
  locationId: number,
): Promise<Schedule[]> {
  const listRes = await commands.listSchedules(environmentId);
  if (listRes.status === "error") throw new Error(listRes.error);

  return listRes.data
    .filter((s) => s.location_id === locationId)
    .sort((a, b) => {
      const an = a.next_run_at ?? "";
      const bn = b.next_run_at ?? "";
      return an.localeCompare(bn);
    });
}
