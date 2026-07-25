"use client";

import { useCallback, useMemo, useState } from "react";

const FIRST = 60;
const MORE = 500;

export interface TruncatedLines<T> {
  expand: () => void;
  hidden: number;
  shown: readonly T[];
}

export interface TruncatedText {
  expand: () => void;
  hidden: number;
  shown: string;
}

export function useTruncatedText(text: string): TruncatedText {
  const lines = useMemo(
    () => (text.length === 0 ? [] : text.split("\n")),
    [text]
  );
  const truncated = useTruncatedLines(lines);

  return useMemo(
    () => ({
      expand: truncated.expand,
      hidden: truncated.hidden,
      shown: truncated.shown.join("\n"),
    }),
    [truncated]
  );
}

export function useTruncatedLines<T>(lines: readonly T[]): TruncatedLines<T> {
  const [limit, setLimit] = useState(FIRST);

  const expand = useCallback(() => {
    setLimit((current) => current + MORE);
  }, []);

  return useMemo(
    () => ({
      expand,
      hidden: Math.max(lines.length - limit, 0),
      shown: lines.length > limit ? lines.slice(0, limit) : lines,
    }),
    [expand, limit, lines]
  );
}
