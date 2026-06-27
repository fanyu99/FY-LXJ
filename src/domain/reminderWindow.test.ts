import { describe, expect, it } from "vitest";
import { REMINDER_WINDOW_OPTIONS } from "./reminderWindow";

describe("REMINDER_WINDOW_OPTIONS", () => {
  it("uses a window size large enough to show reminder content and action buttons", () => {
    expect(REMINDER_WINDOW_OPTIONS.width).toBeGreaterThanOrEqual(640);
    expect(REMINDER_WINDOW_OPTIONS.height).toBeGreaterThanOrEqual(560);
  });
});
