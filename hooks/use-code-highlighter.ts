"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import type { CodeHighlighterPlugin } from "streamdown";
import { loadCodeHighlighter } from "@/lib/studio/highlighter";

export function useCodeHighlighter(): CodeHighlighterPlugin | null {
  const [plugin, setPlugin] = useState<CodeHighlighterPlugin | null>(null);

  useEffect(() => {
    const fiber = Effect.runFork(
      loadCodeHighlighter.pipe(
        Effect.tap((loaded) => Effect.sync(() => setPlugin(loaded))),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  return plugin;
}
