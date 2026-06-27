export function toCssBackgroundImage(path: string | null, convert: (path: string) => string = (value) => value): string {
  if (!path?.trim()) {
    return "none";
  }

  return `url(${JSON.stringify(convert(path))})`;
}

export function isEmbeddedBackgroundImage(path: string | null): boolean {
  return typeof path === "string" && path.startsWith("data:image/");
}

export function toCssBackgroundPosition(x: number, y: number): string {
  return `${x}% ${y}%`;
}

export function toCssBackgroundSize(scale: number): string {
  return `${scale}% auto`;
}
