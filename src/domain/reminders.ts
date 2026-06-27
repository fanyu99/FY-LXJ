import type { Todo } from "./types";
import { computeNextOccurrence } from "./repeat";

const ISO_WITH_OFFSET = /^(.+)([+-]\d{2}:\d{2}|Z)$/;

function splitIsoOffset(value: string): { offset: string } {
  const match = value.match(ISO_WITH_OFFSET);
  if (!match) {
    throw new Error(`Expected ISO datetime with timezone offset: ${value}`);
  }
  return { offset: match[2] };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalWithOffset(date: Date, offset: string): string {
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

function buildReminderAt(dueAt: string, offsetMinutes: number): string {
  const { offset } = splitIsoOffset(dueAt);
  const next = new Date(dueAt);
  next.setMinutes(next.getMinutes() - offsetMinutes);
  return formatLocalWithOffset(next, offset);
}

export function findDueReminders(todos: Todo[], now: string): Todo[] {
  const nowTime = new Date(now).getTime();

  return todos.filter((todo) => {
    if (todo.status === "done" || !todo.reminderEnabled || !todo.nextReminderAt) {
      return false;
    }
    if (todo.lastRemindedAt === todo.nextReminderAt) {
      return false;
    }
    return new Date(todo.nextReminderAt).getTime() <= nowTime;
  });
}

export function snoozeTodo(todo: Todo, now: string, minutes: number): Todo {
  const { offset } = splitIsoOffset(now);
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + minutes);
  const nextAt = formatLocalWithOffset(next, offset);

  return {
    ...todo,
    dueAt: nextAt,
    nextReminderAt: nextAt,
    lastRemindedAt: null,
    updatedAt: now,
  };
}

export function getReminderSeenKey(todo: Todo, now: string): string {
  return todo.nextReminderAt ?? now;
}

export function completeTodoFromReminder(todo: Todo, now: string): Todo {
  const nextDueAt = computeNextOccurrence(todo.dueAt, todo.repeatRule);

  if (!nextDueAt) {
    return {
      ...todo,
      status: "done",
      updatedAt: now,
      completedAt: now,
    };
  }

  return {
    ...todo,
    dueAt: nextDueAt,
    status: "pending",
    nextReminderAt: todo.reminderEnabled ? buildReminderAt(nextDueAt, todo.reminderOffsetMinutes) : null,
    lastRemindedAt: null,
    updatedAt: now,
    completedAt: null,
  };
}

export function serializeReminder(todo: Todo): string {
  return encodeURIComponent(JSON.stringify(todo));
}

export function deserializeReminder(value: string): Todo {
  return JSON.parse(decodeURIComponent(value)) as Todo;
}

export function withReminderSeen(todo: Todo, remindedAt: string): Todo {
  return {
    ...todo,
    lastRemindedAt: remindedAt,
    updatedAt: remindedAt,
  };
}
