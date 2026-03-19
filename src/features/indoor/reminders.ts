import { commands, type Schedule, type ScheduleType } from "../../lib/bindings";

type UpsertReminderInput = {
  environmentId: number;
  locationId: number;
  title: string;
  scheduleType: ScheduleType;
  cronExpression: string;
  notes: string;
};

function matchesReminder(schedule: Schedule, locationId: number, title: string): boolean {
  if (schedule.location_id !== locationId) return false;
  return schedule.title.trim().toLowerCase() === title.trim().toLowerCase();
}

export async function upsertLocationReminder(input: UpsertReminderInput): Promise<Schedule> {
  const listRes = await commands.listSchedules(input.environmentId);
  if (listRes.status === "error") throw new Error(listRes.error);

  const existing = listRes.data.find((s) => matchesReminder(s, input.locationId, input.title));

  if (existing) {
    const updateRes = await commands.updateSchedule(existing.id, {
      schedule_type: input.scheduleType,
      title: input.title,
      cron_expression: input.cronExpression,
      is_active: true,
      plant_id: null,
      location_id: input.locationId,
      additive_id: null,
      notes: input.notes,
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
    notes: input.notes,
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
