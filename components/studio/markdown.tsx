"use client";

import { createContext, use, useMemo } from "react";
import type { IconMap } from "streamdown";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  type Icon,
  Loader2Icon,
  MaximizeIcon,
  RotateCcwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/icons";
import {
  type CodeHighlighting,
  NO_HIGHLIGHTING,
  useCodeHighlighter,
  useHighlighterFor,
  useMarkdownRenderer,
} from "@/hooks/use-code-highlighter";
import { usePrefersReducedMotion } from "@/lib/dotmatrix-hooks";
import { cn } from "@/lib/utils";

function markdownIcon(Component: Icon): IconMap["CopyIcon"] {
  return function MarkdownIcon({ strokeWidth, ...props }) {
    return (
      <Component
        {...props}
        strokeWidth={strokeWidth === undefined ? 1.5 : Number(strokeWidth)}
      />
    );
  };
}

const MARKDOWN_ICONS = {
  CheckIcon: markdownIcon(CheckIcon),
  CopyIcon: markdownIcon(CopyIcon),
  DownloadIcon: markdownIcon(DownloadIcon),
  ExternalLinkIcon: markdownIcon(ExternalLinkIcon),
  Loader2Icon: markdownIcon(Loader2Icon),
  Maximize2Icon: markdownIcon(MaximizeIcon),
  RotateCcwIcon: markdownIcon(RotateCcwIcon),
  XIcon: markdownIcon(XIcon),
  ZoomInIcon: markdownIcon(ZoomInIcon),
  ZoomOutIcon: markdownIcon(ZoomOutIcon),
} satisfies IconMap;

const ANIMATION = {
  animation: "fadeIn",
  duration: 260,
  sep: "word",
  stagger: 14,
} as const;

const HighlighterContext = createContext<CodeHighlighting>(NO_HIGHLIGHTING);

export function MarkdownProvider({ children }: { children: React.ReactNode }) {
  const highlighter = useCodeHighlighter();
  useMarkdownRenderer();

  return (
    <HighlighterContext value={highlighter}>{children}</HighlighterContext>
  );
}

export function Markdown({
  children,
  className,
  isAnimated = true,
  isStreaming = false,
}: {
  children: string;
  className?: string;
  // A file read off disk arrives whole, so revealing it word by word would be
  // an animation of nothing happening. The transcript keeps the reveal.
  isAnimated?: boolean;
  isStreaming?: boolean;
}) {
  const renderer = useMarkdownRenderer();
  const code = useHighlighterFor(use(HighlighterContext), children);
  const plugins = useMemo(() => (code === null ? {} : { code }), [code]);
  const reducedMotion = usePrefersReducedMotion();
  const classes = cn(
    "markdown-stream space-y-3 text-sm leading-relaxed [&_pre]:text-xs",
    isStreaming && !reducedMotion && "code-reveal",
    className
  );

  if (renderer === null) {
    return <div className={cn(classes, "whitespace-pre-wrap")}>{children}</div>;
  }

  return (
    <renderer.Streamdown
      animated={reducedMotion || !isAnimated ? false : ANIMATION}
      className={classes}
      icons={MARKDOWN_ICONS}
      isAnimating={isStreaming}
      lineNumbers={false}
      plugins={plugins}
    >
      {children}
    </renderer.Streamdown>
  );
}
