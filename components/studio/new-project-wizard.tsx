"use client";

import { ChevronLeftIcon, FolderOpenIcon } from "lucide-react";
import { MiddleTruncation } from "@/components/middle-truncation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { NewProject } from "@/hooks/use-new-project";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/studio/formats";
import { cn } from "@/lib/utils";
import { Scrim } from "./scrim";

const RATIO_LABEL = "new-project-ratio";

export function NewProjectWizard({
  control,
  entrance,
}: {
  control: NewProject;
  entrance: string | null;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-1 flex-col", entrance)}>
      <Scrim className="@container m-auto flex w-full min-w-0 flex-col gap-6">
        <div className="flex flex-col items-start gap-3">
          <Button
            className="-ml-2 text-muted-foreground"
            onClick={control.close}
            size="sm"
            variant="ghost"
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Back
          </Button>

          <div className="flex flex-col gap-1">
            <h3 className="text-balance font-semibold text-2xl leading-tight tracking-tight">
              New project
            </h3>
            <p className="text-pretty text-muted-foreground text-sm/relaxed">
              A folder is created for it. Claude writes the Remotion project
              inside.
            </p>
          </div>
        </div>

        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={control.onSubmit}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-project-name">Name</Label>
            {/* A folder name is a slug, not prose or an identity: spelling
                suggestions, autofill and a password manager's overlay are all
                noise on top of a field where they can never be right. */}
            <Input
              autoComplete="off"
              autoFocus
              data-1p-ignore
              data-lpignore="true"
              id="new-project-name"
              onChange={control.onNameChange}
              placeholder="launch-film"
              spellCheck="false"
              value={control.name}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-project-location">Location</Label>
            <Button
              className="w-full min-w-0 justify-start font-normal"
              id="new-project-location"
              onClick={control.pickParent}
              type="button"
              variant="outline"
            >
              <FolderOpenIcon data-icon="inline-start" />
              <MiddleTruncation className="min-w-0 flex-1 text-left">
                {control.parent ?? "Choose a folder…"}
              </MiddleTruncation>
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-medium text-sm leading-none" id={RATIO_LABEL}>
              Aspect ratio
            </span>
            <RadioGroup
              aria-labelledby={RATIO_LABEL}
              className="grid @lg:grid-cols-4 grid-cols-2 gap-2"
              onValueChange={control.onFormatChange}
              value={control.format.id}
            >
              {VIDEO_FORMATS.map((format) => (
                <FormatCard format={format} key={format.id} />
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end">
            <Button disabled={!control.canCreate} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Scrim>
    </div>
  );
}

function FormatCard({ format }: { format: VideoFormat }) {
  return (
    <Label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center font-normal leading-normal transition-colors has-[:focus-visible]:border-ring has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
      <span className="sr-only">
        <RadioGroupItem value={format.id} />
      </span>

      <span className="flex h-9 w-full items-center justify-center">
        <span
          className={cn(
            "rounded-[3px] border-2 border-muted-foreground/60",
            format.width >= format.height ? "w-9" : "h-9"
          )}
          style={{ aspectRatio: `${format.width} / ${format.height}` }}
        />
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{format.label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {format.width}×{format.height}
        </span>
        <span className="text-balance text-muted-foreground text-xs">
          {format.note}
        </span>
      </span>
    </Label>
  );
}
