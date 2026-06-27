import { describe, expect, it } from "vitest";
import { formatDateTimeWithOffset, getTimezoneOffsetLabel } from "./time";

describe("time helpers", () => {
  it("formats a date with the provided timezone offset", () => {
    expect(formatDateTimeWithOffset(new Date(2026, 5, 27, 9, 8, 7), "+08:00")).toBe("2026-06-27T09:08:07+08:00");
  });

  it("formats local timezone offsets", () => {
    expect(getTimezoneOffsetLabel(0)).toBe("+00:00");
    expect(getTimezoneOffsetLabel(-480)).toBe("+08:00");
    expect(getTimezoneOffsetLabel(330)).toBe("-05:30");
  });
});
