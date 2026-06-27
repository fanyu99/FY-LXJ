import type { Priority, RepeatRule, Todo } from "./types";
import { formatLocalWithOffset } from "./reminders";

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

export interface TodoEditContext {
  now: string;
  timezoneOffset: string;
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

export function todoToFormValues(todo: Todo): TodoFormValues {
  return {
    title: todo.title,
    description: todo.description,
    location: todo.location,
    date: todo.dueAt.slice(0, 10),
    time: todo.dueAt.slice(11, 16),
    priority: todo.priority,
    category: todo.category,
    reminderEnabled: todo.reminderEnabled,
    reminderOffsetMinutes: todo.reminderOffsetMinutes,
    repeatType: todo.repeatRule.type,
  };
}

export function updateTodoFromForm(todo: Todo, values: TodoFormValues, context: TodoEditContext): Todo {
  const dueAt = buildDueAt(values.date, values.time, context.timezoneOffset);
  const repeatRule: RepeatRule = { type: values.repeatType } as RepeatRule;
  const shouldReopen = todo.status === "done" && new Date(dueAt).getTime() > new Date(context.now).getTime();

  return {
    ...todo,
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim(),
    dueAt,
    priority: values.priority,
    category: values.category,
    reminderEnabled: values.reminderEnabled,
    reminderOffsetMinutes: values.reminderOffsetMinutes,
    repeatRule,
    nextReminderAt: values.reminderEnabled
      ? buildNextReminderAt(dueAt, values.reminderOffsetMinutes, context.timezoneOffset)
      : null,
    lastRemindedAt: null,
    status: shouldReopen ? "pending" : todo.status,
    completedAt: shouldReopen ? null : todo.completedAt,
    updatedAt: context.now,
  };
}
