import type { AppSettings } from "./types";
import { normalizeAppSettings } from "./appSettings";

const BROWSER_SETTINGS_KEY = "liuyun.browserSettings";

export function loadBrowserSettings(storage: Storage, fallback: AppSettings): AppSettings {
  const raw = storage.getItem(BROWSER_SETTINGS_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    return normalizeAppSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function saveBrowserSettings(storage: Storage, settings: AppSettings): void {
  storage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(settings));
}
