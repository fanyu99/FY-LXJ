import { describe, expect, it } from "vitest";
import { sampleSettings } from "./sampleData";
import { applySettingsDraftPatch, areAppSettingsEqual, hasSettingsDraftChanges, resetSettingsDraft } from "./settingsDraft";

describe("settings draft helpers", () => {
  it("keeps save data as the edited draft", () => {
    const draft = applySettingsDraftPatch(sampleSettings, {
      fontFamily: "system",
      backgroundOpacity: 0.45,
    });

    expect(draft).toMatchObject({
      fontFamily: "system",
      backgroundOpacity: 0.45,
    });
  });

  it("resets cancel data to the saved settings", () => {
    const edited = applySettingsDraftPatch(sampleSettings, {
      fontSize: 20,
      backgroundImagePath: "D:\\Desktop\\bg.gif",
    });

    expect(resetSettingsDraft(sampleSettings)).toEqual(sampleSettings);
    expect(resetSettingsDraft(sampleSettings)).not.toEqual(edited);
  });

  it("detects when the draft differs from the saved settings", () => {
    const edited = applySettingsDraftPatch(sampleSettings, {
      backgroundImagePath: "data:image/gif;base64,abc",
    });

    expect(hasSettingsDraftChanges(sampleSettings, edited)).toBe(true);
    expect(hasSettingsDraftChanges(sampleSettings, resetSettingsDraft(sampleSettings))).toBe(false);
  });

  it("compares all persisted setting fields", () => {
    expect(areAppSettingsEqual(sampleSettings, { ...sampleSettings })).toBe(true);
    expect(areAppSettingsEqual(sampleSettings, { ...sampleSettings, closeToTray: !sampleSettings.closeToTray })).toBe(false);
    expect(areAppSettingsEqual(sampleSettings, { ...sampleSettings, snoozeMinutes: sampleSettings.snoozeMinutes + 5 })).toBe(false);
    expect(areAppSettingsEqual(sampleSettings, { ...sampleSettings, backgroundPositionX: sampleSettings.backgroundPositionX + 5 })).toBe(false);
  });
});
