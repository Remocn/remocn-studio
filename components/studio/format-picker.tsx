"use client";

import { CheckIcon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/studio/formats";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "./platform-logo";

export function FormatPicker({
  id,
  layout = "project",
  onChange,
  value,
}: {
  id: string;
  layout?: "project" | "video";
  onChange: (id: string) => void;
  value: VideoFormat;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="font-medium text-sm" id={id}>
        Aspect ratio
      </span>
      <RadioGroup
        aria-labelledby={id}
        className={cn(
          "grid grid-cols-2 gap-3",
          layout === "video"
            ? "@min-[584px]:grid-cols-4"
            : "@min-[632px]:grid-cols-4"
        )}
        onValueChange={onChange}
        value={value.id}
      >
        {VIDEO_FORMATS.map((format) => (
          <FormatCard format={format} key={format.id} />
        ))}
      </RadioGroup>
    </div>
  );
}

const SHAPES: Record<string, string> = {
  landscape: "h-9 w-16",
  portrait: "h-[45px] w-9",
  square: "size-[42px]",
  vertical: "h-12 w-[27px]",
};

const PLATFORMS = {
  landscape: ["youtube"],
  portrait: ["instagram"],
  square: ["instagram"],
  vertical: ["youtubeshorts", "tiktok", "instagram"],
} as const;

function FormatCard({ format }: { format: VideoFormat }) {
  const platforms = PLATFORMS[format.id as keyof typeof PLATFORMS];
  return (
    <Label className="group relative flex h-44 min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-field p-4 text-center font-normal leading-normal transition-colors hover:bg-accent has-[[data-checked]]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2">
      <span className="sr-only">
        <RadioGroupItem value={format.id} />
      </span>
      <CheckIcon
        aria-hidden="true"
        className="absolute top-2.5 right-2.5 hidden size-3.5 group-has-[[data-checked]]:block"
      />
      <span
        aria-hidden="true"
        className="flex h-12 w-full shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "rounded-[2px] border-[1.5px] border-muted-foreground",
            SHAPES[format.id]
          )}
        />
      </span>
      <span className="font-medium text-lg leading-6">{format.label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {format.width}×{format.height}
      </span>
      <span
        aria-label={format.note}
        className="mt-1 flex h-8 shrink-0 -space-x-1.5"
        role="img"
        title={format.note}
      >
        {platforms.map((platform) => (
          <span
            className="flex size-8 items-center justify-center rounded-full bg-popover"
            key={platform}
          >
            <PlatformLogo className="size-4" platform={platform} />
          </span>
        ))}
      </span>
    </Label>
  );
}
