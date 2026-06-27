import { formatLocalWithOffset } from "./reminders";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function getTimezoneOffsetLabel(offsetMinutes: number = new Date().getTimezoneOffset()): string {
  const totalMinutes = -offsetMinutes;
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
}

export function formatDateTimeWithOffset(date: Date, offset: string = getTimezoneOffsetLabel(date.getTimezoneOffset())): string {
  return formatLocalWithOffset(date, offset);
}

export function nowLocalIso(): string {
  return formatDateTimeWithOffset(new Date());
}

export function todayLocalDateKey(): string {
  return nowLocalIso().slice(0, 10);
}
