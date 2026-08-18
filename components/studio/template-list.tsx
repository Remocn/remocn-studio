"use client";

import {
  GraduationCapIcon,
  type LucideIcon,
  MonitorPlayIcon,
  MusicIcon,
  QuoteIcon,
  RocketIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { PROMPT_TEMPLATES } from "@/lib/studio/templates";
import { cn } from "@/lib/utils";

const BY_ID = new Map(
  PROMPT_TEMPLATES.map((template) => [template.id, template])
);

const ICONS = new Map<string, LucideIcon>([
  ["changelog", ScrollTextIcon],
  ["launch-teaser", RocketIcon],
  ["logo-intro", SparklesIcon],
  ["lyric-video", MusicIcon],
  ["product-demo", MonitorPlayIcon],
  ["quote", QuoteIcon],
  ["tiktok-vertical", SmartphoneIcon],
  ["tutorial", GraduationCapIcon],
]);

function iconOf(id: string): LucideIcon {
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
    <div className={cn("flex w-full flex-col", className)}>
      {PROMPT_TEMPLATES.map((template) => {
        const Icon = iconOf(template.id);
        return (
          <button
            className="flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={template.id}
            onClick={pick}
            type="button"
            value={template.id}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
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
