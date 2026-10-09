"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewVideo } from "@/hooks/use-new-video";
import { cn } from "@/lib/utils";
import { FormatPicker } from "./format-picker";
import { Scrim } from "./scrim";

const RATIO_LABEL = "new-video-ratio";

export function NewVideoWizard({
  control,
  entrance,
  project,
}: {
  control: NewVideo;
  entrance: string | null;
  project: string | null;
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
            <h3 className="text-balance font-semibold text-xl leading-7 tracking-[-0.03em]">
              New video
            </h3>
            <p className="text-pretty text-muted-foreground text-sm/relaxed">
              {project === null
                ? "It lives in this project, beside the videos already here."
                : `It lives in ${project}, beside the videos already there.`}{" "}
              Rename it whenever you like.
            </p>
          </div>
        </div>

        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={control.onSubmit}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-video-name">Name</Label>
            <Input
              autoComplete="off"
              autoFocus
              data-1p-ignore
              data-lpignore="true"
              id="new-video-name"
              onChange={control.onNameChange}
              placeholder="Opening title"
              value={control.name}
            />
          </div>

          <FormatPicker
            id={RATIO_LABEL}
            layout="video"
            onChange={control.onFormatChange}
            value={control.format}
          />

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
