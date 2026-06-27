import { describe, expect, it } from "vitest";
import defaultCapability from "../../src-tauri/capabilities/default.json";

describe("Tauri capability", () => {
  it("grants IPC permissions to reminder popup windows", () => {
    expect(defaultCapability.windows).toContain("main");
    expect(defaultCapability.windows).toContain("reminder-*");
  });
});
