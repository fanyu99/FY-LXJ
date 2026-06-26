import type { RepeatRule } from "./types";

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

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
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

export function computeNextOccurrence(dueAt: string, rule: RepeatRule): string | null {
  if (rule.type === "none") {
    return null;
  }

  const { offset } = splitIsoOffset(dueAt);
  const date = new Date(dueAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid dueAt datetime: ${dueAt}`);
  }

  if (rule.type === "daily") {
    date.setDate(date.getDate() + 1);
    return formatLocalWithOffset(date, offset);
  }

  if (rule.type === "weekly") {
    date.setDate(date.getDate() + 7);
    return formatLocalWithOffset(date, offset);
  }

  const originalDay = date.getDate();
  const nextMonthIndex = date.getMonth() + 1;
  const nextYear = date.getFullYear() + Math.floor(nextMonthIndex / 12);
  const normalizedMonthIndex = nextMonthIndex % 12;
  const clampedDay = Math.min(originalDay, daysInMonth(nextYear, normalizedMonthIndex));
  date.setFullYear(nextYear, normalizedMonthIndex, clampedDay);
  return formatLocalWithOffset(date, offset);
}
