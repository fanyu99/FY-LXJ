import type { Todo } from "./types";

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

  return {
    ...todo,
    nextReminderAt: formatLocalWithOffset(next, offset),
    updatedAt: now,
  };
}
