"use client";

import { CircleArrowUpIcon, RefreshCwIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import type { Updates } from "@/hooks/use-updates";
import { downloadedLabel, downloadedShare } from "@/lib/studio/updates";
import type { AppEnvironment } from "@/shared/ipc";
import { useStudio } from "./studio-provider";

const ENVIRONMENTS: Record<AppEnvironment, string> = {
  development: "Development",
  production: "Production",
};

export function UpdateStatus() {
  // The same `useUpdates` state feeds the Settings dialog's Updates section —
  // one source, two surfaces, so the two can never disagree about a release.
  const { updates } = useStudio();
  const { release, version } = updates;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <SidebarMenuButton
            className={release === null ? "text-muted-foreground" : undefined}
          />
        }
      >
        {release === null ? <TagIcon /> : <CircleArrowUpIcon />}
        {release === null
          ? `Version ${version ?? "—"}`
          : `Update to ${release.version}`}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 gap-3" side="top">
        <PopoverTitle className="text-sm">Updates</PopoverTitle>
        <UpdatesBody updates={updates} />
      </PopoverContent>
    </Popover>
  );
}

export function UpdatesBody({ updates }: { updates: Updates }) {
  const { hasRunningTurns } = useStudio();
  const { download, release } = updates;

  return (
    <>
      <p className="text-muted-foreground text-xs">{describe(updates)}</p>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Installed</dt>
        <dd className="font-mono">{updates.version ?? "—"}</dd>
        <dt className="text-muted-foreground">Build</dt>
        <dd className="font-mono">
          {updates.environment === null
            ? "—"
            : ENVIRONMENTS[updates.environment]}
        </dd>
      </dl>

      {release?.body ? (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-muted-foreground text-xs">
          {release.body}
        </p>
      ) : null}

      {download === null ? null : (
        <Progress className="gap-1.5" value={downloadedShare(download)}>
          <span className="text-muted-foreground text-xs tabular-nums">
            {downloadedLabel(download)}
          </span>
        </Progress>
      )}

      <div className="flex items-center gap-1">
        <Button
          disabled={
            updates.unavailable !== null ||
            updates.isChecking ||
            updates.isInstalling
          }
          onClick={updates.check}
          size="xs"
          title={updates.unavailable ?? "Ask GitHub for the newest release"}
          variant="outline"
        >
          {updates.isChecking ? (
            <Spinner className="size-3.5" data-icon="inline-start" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          Check now
        </Button>

        {release === null ? null : (
          <Button
            disabled={updates.isInstalling}
            onClick={updates.install}
            size="xs"
          >
            <CircleArrowUpIcon data-icon="inline-start" />
            Install and restart
          </Button>
        )}
      </div>

      {release !== null && hasRunningTurns && !updates.isInstalling ? (
        <p className="text-amber-500 text-xs">
          A turn is still running — installing restarts the app and stops it.
        </p>
      ) : null}

      {updates.error === null ? null : (
        <p className="text-destructive text-xs">{updates.error}</p>
      )}
    </>
  );
}

function describe(updates: Updates): string {
  if (updates.unavailable !== null) {
    return updates.unavailable;
  }

  if (updates.download !== null) {
    return "Downloading the new build — the app restarts when it lands";
  }

  if (updates.isChecking) {
    return "Asking GitHub for the newest release";
  }

  if (updates.release !== null) {
    return `${updates.release.version} is out, and this build is older`;
  }

  return updates.hasChecked
    ? "This is the newest release"
    : "Not checked yet in this session";
}
