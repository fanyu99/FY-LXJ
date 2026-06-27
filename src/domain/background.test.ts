import { describe, expect, it } from "vitest";
import { isEmbeddedBackgroundImage, toCssBackgroundImage, toCssBackgroundPosition, toCssBackgroundSize } from "./background";

describe("toCssBackgroundImage", () => {
  it("returns none when the path is empty", () => {
    expect(toCssBackgroundImage(null)).toBe("none");
    expect(toCssBackgroundImage("")).toBe("none");
  });

  it("wraps converted local paths as a CSS url", () => {
    expect(toCssBackgroundImage("D:\\Desktop\\背景 图.png", (path) => `asset://${path}`)).toBe(
      'url("asset://D:\\\\Desktop\\\\背景 图.png")',
    );
  });

  it("detects browser-selected embedded background images", () => {
    expect(isEmbeddedBackgroundImage("data:image/png;base64,abc")).toBe(true);
    expect(isEmbeddedBackgroundImage("data:image/gif;base64,abc")).toBe(true);
    expect(isEmbeddedBackgroundImage("D:\\Desktop\\bg.png")).toBe(false);
    expect(isEmbeddedBackgroundImage(null)).toBe(false);
  });

  it("converts crop controls into stable CSS values", () => {
    expect(toCssBackgroundPosition(25, 70)).toBe("25% 70%");
    expect(toCssBackgroundSize(160)).toBe("160% auto");
  });
});
