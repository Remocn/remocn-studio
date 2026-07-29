export const GRAB_PATH = "/__remocn/grab.js";

const WEB_FONT_IMPORT =
  /@import url\(\\?["']https?:[^"'\\]*\\?["']\);?(?:\\n)?/g;

export interface GrabScript {
  readonly removed: number;
  readonly source: string;
}

export function withoutWebFonts(source: string): GrabScript {
  const matches = source.match(WEB_FONT_IMPORT);

  return {
    removed: matches?.length ?? 0,
    source: source.replace(WEB_FONT_IMPORT, ""),
  };
}
