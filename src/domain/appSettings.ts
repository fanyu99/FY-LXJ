import type { AppSettings } from "./types";

type RawSettings = Partial<AppSettings> & {
  launch_on_startup?: unknown;
  close_to_tray?: unknown;
  font_family?: unknown;
  font_size?: unknown;
  theme_color?: unknown;
  background_image_path?: unknown;
  background_opacity?: unknown;
  background_position_x?: unknown;
  background_position_y?: unknown;
  background_scale?: unknown;
  reminder_recheck_seconds?: unknown;
  snooze_minutes?: unknown;
};

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function booleanOrFallback(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function nullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : fallback;
}

function readNullableString(raw: RawSettings, camelKey: "backgroundImagePath", snakeKey: "background_image_path", fallback: string | null): string | null {
  if (Object.prototype.hasOwnProperty.call(raw, camelKey)) {
    return nullableString(raw[camelKey], fallback);
  }
  if (Object.prototype.hasOwnProperty.call(raw, snakeKey)) {
    return nullableString(raw[snakeKey], fallback);
  }
  return fallback;
}

export function normalizeAppSettings(value: unknown, fallback: AppSettings): AppSettings {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value as RawSettings;
  const fontFamily = raw.fontFamily ?? raw.font_family;

  return {
    launchOnStartup: booleanOrFallback(raw.launchOnStartup ?? raw.launch_on_startup, fallback.launchOnStartup),
    closeToTray: booleanOrFallback(raw.closeToTray ?? raw.close_to_tray, fallback.closeToTray),
    fontFamily: fontFamily === "system" || fontFamily === "lxgw-wenkai" ? fontFamily : fallback.fontFamily,
    fontSize: numberInRange(raw.fontSize ?? raw.font_size, fallback.fontSize, 12, 24),
    themeColor: stringOrFallback(raw.themeColor ?? raw.theme_color, fallback.themeColor),
    backgroundImagePath: readNullableString(raw, "backgroundImagePath", "background_image_path", fallback.backgroundImagePath),
    backgroundOpacity: numberInRange(raw.backgroundOpacity ?? raw.background_opacity, fallback.backgroundOpacity, 0.2, 1),
    backgroundPositionX: numberInRange(raw.backgroundPositionX ?? raw.background_position_x, fallback.backgroundPositionX, 0, 100),
    backgroundPositionY: numberInRange(raw.backgroundPositionY ?? raw.background_position_y, fallback.backgroundPositionY, 0, 100),
    backgroundScale: numberInRange(raw.backgroundScale ?? raw.background_scale, fallback.backgroundScale, 50, 300),
    reminderRecheckSeconds: numberInRange(raw.reminderRecheckSeconds ?? raw.reminder_recheck_seconds, fallback.reminderRecheckSeconds, 10, 300),
    snoozeMinutes: numberInRange(raw.snoozeMinutes ?? raw.snooze_minutes, fallback.snoozeMinutes, 1, 240),
  };
}
