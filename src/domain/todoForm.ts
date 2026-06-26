import type { Priority, RepeatRule, Todo } from "./types";

export interface TodoFormValues {
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  priority: Priority;
  category: string;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
  repeatType: RepeatRule["type"];
}

export interface TodoFormContext {
  id: string;
  now: string;
  timezoneOffset: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLocalWithOffset(date: Date, offset: string): string {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
    offset,
  ].join("");
}

function buildDueAt(date: string, time: string, timezoneOffset: string): string {
  return `${date}T${time || "09:00"}:00${timezoneOffset}`;
}

function buildNextReminderAt(dueAt: string, offsetMinutes: number, timezoneOffset: string): string {
  const next = new Date(dueAt);
  next.setMinutes(next.getMinutes() - offsetMinutes);
  return formatLocalWithOffset(next, timezoneOffset);
}

export function createTodoFromForm(values: TodoFormValues, context: TodoFormContext): Todo {
  const dueAt = buildDueAt(values.date, values.time, context.timezoneOffset);
  const repeatRule: RepeatRule = { type: values.repeatType } as RepeatRule;

  return {
    id: context.id,
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim(),
    dueAt,
    priority: values.priority,
    category: values.category,
    status: "pending",
    reminderEnabled: values.reminderEnabled,
    reminderOffsetMinutes: values.reminderOffsetMinutes,
    repeatRule,
    nextReminderAt: values.reminderEnabled
      ? buildNextReminderAt(dueAt, values.reminderOffsetMinutes, context.timezoneOffset)
      : null,
    lastRemindedAt: null,
    createdAt: context.now,
    updatedAt: context.now,
    completedAt: null,
  };
}
