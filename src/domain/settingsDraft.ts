import type { AppSettings } from "./types";

export function applySettingsDraftPatch(current: AppSettings, update: Partial<AppSettings>): AppSettings {
  return { ...current, ...update };
}

export function resetSettingsDraft(settings: AppSettings): AppSettings {
  return { ...settings };
}

export function areAppSettingsEqual(left: AppSettings, right: AppSettings): boolean {
  return (
    left.launchOnStartup === right.launchOnStartup &&
    left.closeToTray === right.closeToTray &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize &&
    left.themeColor === right.themeColor &&
    left.backgroundImagePath === right.backgroundImagePath &&
    left.backgroundOpacity === right.backgroundOpacity &&
    left.backgroundPositionX === right.backgroundPositionX &&
    left.backgroundPositionY === right.backgroundPositionY &&
    left.backgroundScale === right.backgroundScale &&
    left.reminderRecheckSeconds === right.reminderRecheckSeconds &&
    left.snoozeMinutes === right.snoozeMinutes
  );
}

export function hasSettingsDraftChanges(saved: AppSettings, draft: AppSettings): boolean {
  return !areAppSettingsEqual(saved, draft);
}
