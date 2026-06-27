import { describe, expect, it } from "vitest";
import { sampleSettings } from "./sampleData";
import { loadBrowserSettings, saveBrowserSettings } from "./settingsStorage";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("browser settings storage", () => {
  it("loads the fallback settings when browser storage is empty", () => {
    expect(loadBrowserSettings(createMemoryStorage(), sampleSettings)).toEqual(sampleSettings);
  });

  it("saves and loads edited settings in browser storage", () => {
    const storage = createMemoryStorage();
    const edited = {
      ...sampleSettings,
      fontFamily: "system" as const,
      backgroundImagePath: "data:image/gif;base64,abc",
      backgroundOpacity: 0.4,
    };

    saveBrowserSettings(storage, edited);

    expect(loadBrowserSettings(storage, sampleSettings)).toEqual(edited);
  });
});
