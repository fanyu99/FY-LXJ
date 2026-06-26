import { describe, expect, it } from "vitest";
import { computeNextOccurrence } from "./repeat";
import type { RepeatRule } from "./types";

describe("computeNextOccurrence", () => {
  it("returns null for a non-repeating task", () => {
    const rule: RepeatRule = { type: "none" };

    const next = computeNextOccurrence("2026-06-26T09:30:00+08:00", rule);

    expect(next).toBeNull();
  });

  it("moves daily tasks to the next day at the same local time", () => {
    const rule: RepeatRule = { type: "daily" };

    const next = computeNextOccurrence("2026-06-26T09:30:00+08:00", rule);

    expect(next).toBe("2026-06-27T09:30:00+08:00");
  });

  it("moves weekly tasks forward by seven days", () => {
    const rule: RepeatRule = { type: "weekly" };

    const next = computeNextOccurrence("2026-06-26T14:00:00+08:00", rule);

    expect(next).toBe("2026-07-03T14:00:00+08:00");
  });

  it("clamps monthly tasks when the next month has fewer days", () => {
    const rule: RepeatRule = { type: "monthly" };

    const next = computeNextOccurrence("2026-01-31T20:00:00+08:00", rule);

    expect(next).toBe("2026-02-28T20:00:00+08:00");
  });
});
