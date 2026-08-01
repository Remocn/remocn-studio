"use client";

import { createContext, use, useMemo } from "react";
import { type CodeHighlighterPlugin, Streamdown } from "streamdown";
import { useCodeHighlighter } from "@/hooks/use-code-highlighter";
import { usePrefersReducedMotion } from "@/lib/dotmatrix-hooks";
import { cn } from "@/lib/utils";

const ANIMATION = {
  animation: "fadeIn",
  duration: 260,
  sep: "word",
  stagger: 14,
} as const;

const HighlighterContext = createContext<CodeHighlighterPlugin | null>(null);

export function MarkdownProvider({ children }: { children: React.ReactNode }) {
  const highlighter = useCodeHighlighter();

  return (
    <HighlighterContext value={highlighter}>{children}</HighlighterContext>
  );
}

export function Markdown({
  children,
  className,
  isStreaming = false,
}: {
  children: string;
  className?: string;
  isStreaming?: boolean;
}) {
  const code = use(HighlighterContext);
  const plugins = useMemo(() => (code === null ? {} : { code }), [code]);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Streamdown
      animated={reducedMotion ? false : ANIMATION}
      className={cn(
        "markdown-stream space-y-3 text-sm leading-relaxed [&_pre]:text-xs",
        isStreaming && !reducedMotion && "code-reveal",
        className
      )}
      isAnimating={isStreaming}
      lineNumbers={false}
      plugins={plugins}
    >
      {children}
    </Streamdown>
  );
}
