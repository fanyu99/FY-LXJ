import { describe, expect, it } from "vitest";
import { sampleSettings } from "./sampleData";
import { normalizeAppSettings } from "./appSettings";

describe("normalizeAppSettings", () => {
  it("keeps valid camelCase settings", () => {
    expect(normalizeAppSettings({ ...sampleSettings, fontFamily: "system", fontSize: 18 }, sampleSettings)).toMatchObject({
      fontFamily: "system",
      fontSize: 18,
    });
  });

  it("converts legacy snake_case settings from Rust", () => {
    expect(
      normalizeAppSettings(
        {
          launch_on_startup: false,
          close_to_tray: false,
          font_family: "system",
          font_size: 16,
          theme_color: "#335577",
          background_image_path: "D:/bg.gif",
          background_opacity: 0.65,
          background_position_x: 25,
          background_position_y: 70,
          background_scale: 160,
          reminder_recheck_seconds: 45,
          snooze_minutes: 20,
        },
        sampleSettings,
      ),
    ).toEqual({
      launchOnStartup: false,
      closeToTray: false,
      fontFamily: "system",
      fontSize: 16,
      themeColor: "#335577",
      backgroundImagePath: "D:/bg.gif",
      backgroundOpacity: 0.65,
      backgroundPositionX: 25,
      backgroundPositionY: 70,
      backgroundScale: 160,
      reminderRecheckSeconds: 45,
      snoozeMinutes: 20,
    });
  });

  it("falls back to defaults for invalid settings", () => {
    expect(normalizeAppSettings({ font_family: "bad", font_size: 0 }, sampleSettings)).toMatchObject({
      fontFamily: sampleSettings.fontFamily,
      fontSize: sampleSettings.fontSize,
    });
  });

  it("keeps explicit null background image instead of falling back to the old background", () => {
    const fallback = {
      ...sampleSettings,
      backgroundImagePath: "D:\\Desktop\\old-background.png",
    };

    expect(normalizeAppSettings({ backgroundImagePath: null }, fallback).backgroundImagePath).toBeNull();
    expect(normalizeAppSettings({ background_image_path: null }, fallback).backgroundImagePath).toBeNull();
  });

  it("normalizes snooze minutes with a safe range", () => {
    expect(normalizeAppSettings({ snoozeMinutes: 15 }, sampleSettings).snoozeMinutes).toBe(15);
    expect(normalizeAppSettings({ snooze_minutes: 30 }, sampleSettings).snoozeMinutes).toBe(30);
    expect(normalizeAppSettings({ snoozeMinutes: 0 }, sampleSettings).snoozeMinutes).toBe(sampleSettings.snoozeMinutes);
    expect(normalizeAppSettings({ snoozeMinutes: 999 }, sampleSettings).snoozeMinutes).toBe(sampleSettings.snoozeMinutes);
  });

  it("normalizes background crop controls with safe ranges", () => {
    expect(
      normalizeAppSettings(
        {
          backgroundPositionX: 20,
          background_position_y: 80,
          backgroundScale: 180,
        },
        sampleSettings,
      ),
    ).toMatchObject({
      backgroundPositionX: 20,
      backgroundPositionY: 80,
      backgroundScale: 180,
    });

    expect(
      normalizeAppSettings(
        {
          backgroundPositionX: -1,
          backgroundPositionY: 101,
          backgroundScale: 999,
        },
        sampleSettings,
      ),
    ).toMatchObject({
      backgroundPositionX: sampleSettings.backgroundPositionX,
      backgroundPositionY: sampleSettings.backgroundPositionY,
      backgroundScale: sampleSettings.backgroundScale,
    });
  });
});
