import type { Todo } from "./types";
import { getReminderSeenKey, withReminderSeen } from "./reminders";

export type ReminderDispatchResult = "none" | "existing" | "created";

export interface ReminderDispatchActions {
  getExistingReminderWindow: (label: string) => Promise<unknown | null>;
  createReminderWindow: (label: string, reminder: Todo) => Promise<unknown>;
  markReminderSeen: (id: string, remindedAt: string, now: string) => Promise<void>;
}

export async function dispatchFirstDueReminder(
  dueTodos: Todo[],
  now: string,
  actions: ReminderDispatchActions,
): Promise<ReminderDispatchResult> {
  const reminderTodo = dueTodos[0];
  if (!reminderTodo) {
    return "none";
  }

  const label = `reminder-${reminderTodo.id}`;
  const existing = await actions.getExistingReminderWindow(label);
  if (existing) {
    return "existing";
  }

  const seenKey = getReminderSeenKey(reminderTodo, now);
  await actions.createReminderWindow(label, withReminderSeen(reminderTodo, seenKey));
  await actions.markReminderSeen(reminderTodo.id, seenKey, now);
  return "created";
}
