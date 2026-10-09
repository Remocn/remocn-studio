"use client";

import type { MouseEvent } from "react";
import { useCallback } from "react";
import {
  GraduationCapIcon,
  type Icon,
  MonitorPlayIcon,
  MusicIcon,
  QuoteIcon,
  RocketIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "@/components/icons";
import { PROMPT_TEMPLATES } from "@/lib/studio/templates";
import { cn } from "@/lib/utils";

const BY_ID = new Map(
  PROMPT_TEMPLATES.map((template) => [template.id, template])
);

const ICONS = new Map<string, Icon>([
  ["changelog", ScrollTextIcon],
  ["launch-teaser", RocketIcon],
  ["logo-intro", SparklesIcon],
  ["lyric-video", MusicIcon],
  ["product-demo", MonitorPlayIcon],
  ["quote", QuoteIcon],
  ["tiktok-vertical", SmartphoneIcon],
  ["tutorial", GraduationCapIcon],
]);

function iconOf(id: string): Icon {
  return ICONS.get(id) ?? SparklesIcon;
}

export function TemplateList({
  className,
  onPick,
}: {
  className?: string;
  onPick: (prompt: string) => void;
}) {
  const pick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const template = BY_ID.get(event.currentTarget.value);
      if (template !== undefined) {
        onPick(template.prompt);
      }
    },
    [onPick]
  );

  return (
    <div className={cn("flex w-full min-w-0 flex-col", className)}>
      {PROMPT_TEMPLATES.map((template) => {
        const Glyph = iconOf(template.id);
        return (
          <button
            className="flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            key={template.id}
            onClick={pick}
            title={`${template.title} — ${template.description}`}
            type="button"
            value={template.id}
          >
            <Glyph className="size-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 font-medium text-foreground text-sm">
              {template.title}
            </span>
            <span className="min-w-0 truncate text-muted-foreground text-xs">
              {template.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
