"use client";

import { DownloadIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { Exporting } from "@/hooks/use-export";
import { ExportDialog } from "./export-dialog";

export function ExportButton({
  composition = null,
  exporting,
  renderDialog = true,
}: {
  readonly composition?: string | null;
  readonly exporting: Exporting;
  readonly renderDialog?: boolean;
}) {
  const { brief } = exporting;

  if (!exporting.isRunning || brief === null) {
    return (
      <>
        <Button
          aria-disabled={!exporting.canExport}
          className="min-w-22 aria-disabled:opacity-50"
          onClick={exporting.open}
          size="sm"
          title={
            exporting.unavailable ??
            "Pick a format and a place to save, then render"
          }
          variant="key-action"
        >
          <DownloadIcon data-icon="inline-start" />
          Export
        </Button>
        {renderDialog ? (
          <ExportDialog composition={composition} exporting={exporting} />
        ) : null}
      </>
    );
  }

  return (
    <fieldset
      aria-label="Export"
      className="relative m-0 flex h-7 min-w-36 items-center overflow-hidden rounded-lg bg-control p-0 text-xs"
    >
      {brief.percent === null ? null : (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-base ease-out"
          style={{ width: `${brief.percent}%` }}
        />
      )}
      <span
        className="relative flex min-w-0 flex-1 items-center gap-1.5 truncate pl-2 tabular-nums"
        role="status"
        title={exporting.status ?? undefined}
      >
        {brief.percent === null ? (
          <Spinner aria-hidden="true" className="size-3 shrink-0" />
        ) : null}
        {brief.label}
      </span>
      <Popover
        onOpenChange={exporting.onConfirmChange}
        open={exporting.isConfirmingCancel}
      >
        <PopoverTrigger
          render={
            <Button
              aria-label="Cancel the export"
              className="relative shrink-0"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <XIcon />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverTitle className="text-sm">Stop the export?</PopoverTitle>
          <PopoverDescription className="text-xs">
            What has rendered so far is thrown away and no file is written.
          </PopoverDescription>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              onClick={exporting.keepExporting}
              size="xs"
              variant="outline"
            >
              Keep exporting
            </Button>
            <Button
              onClick={exporting.confirmCancel}
              size="xs"
              variant="destructive"
            >
              Stop
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </fieldset>
  );
}
