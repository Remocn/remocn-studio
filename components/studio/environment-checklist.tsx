"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  RotateCwIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCopyCommand } from "@/hooks/use-copy-command";
import type { Environment } from "@/hooks/use-environment";
import { cn } from "@/lib/utils";
import type { EnvironmentCheck, EnvironmentState } from "@/shared/ipc";

// Shared with the Settings dialog's AI accounts section, so a state reads
// the same everywhere it appears.
export const CHECK_ICONS = {
  failed: XCircleIcon,
  ok: CheckIcon,
  pending: RotateCwIcon,
  warn: AlertTriangleIcon,
} satisfies Record<EnvironmentState, typeof CheckIcon>;

export const CHECK_TONES = {
  failed: "text-destructive",
  ok: "text-muted-foreground",
  pending: "text-muted-foreground",
  warn: "text-amber-500",
} satisfies Record<EnvironmentState, string>;

export function EnvironmentChecklist({
  environment,
}: {
  environment: Environment;
}) {
  const { copied, onCopy } = useCopyCommand();

  if (environment.troubles.length === 0 && environment.error === null) {
    return null;
  }

  return (
    <div className="mb-2 shrink-0 px-4 pt-1">
      <section
        aria-label="Environment checklist"
        className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-dashed px-3 py-2.5"
      >
        <header className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-xs">
            This project is not ready to run
          </h3>
          <Button
            disabled={environment.isChecking}
            onClick={environment.recheck}
            size="xs"
            variant="ghost"
          >
            {environment.isChecking ? (
              <Spinner className="size-3" data-icon="inline-start" />
            ) : (
              <RotateCwIcon data-icon="inline-start" />
            )}
            Recheck
          </Button>
        </header>

        {environment.troubles.map((check) => (
          <CheckRow
            check={check}
            copied={copied}
            environment={environment}
            key={check.id}
            onCopy={onCopy}
          />
        ))}

        {environment.error === null ? null : (
          <p className="text-destructive text-xs" role="alert">
            {environment.error}
          </p>
        )}
      </section>
    </div>
  );
}

function CheckRow({
  check,
  copied,
  environment,
  onCopy,
}: {
  check: EnvironmentCheck;
  copied: string | null;
  environment: Environment;
  onCopy: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const Icon = CHECK_ICONS[check.state];

  return (
    <div className="flex items-start gap-2">
      <Icon
        className={cn("mt-0.5 size-3.5 shrink-0", CHECK_TONES[check.state])}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs leading-snug">{check.title}</p>

        {check.detail === null ? null : (
          <p className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-snug">
            {check.detail}
          </p>
        )}

        {check.fix?.type === "command" ? (
          <div className="flex items-center gap-2">
            <code className="select-text rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {check.fix.command}
            </code>
            <Button
              onClick={onCopy}
              size="xs"
              value={check.fix.command}
              variant="ghost"
            >
              {copied === check.fix.command ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied === check.fix.command ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}

        {check.fix?.type === "install" ? (
          <div className="flex items-center gap-2">
            <Button
              disabled={environment.isInstalling}
              onClick={environment.install}
              size="xs"
              variant="outline"
            >
              {environment.isInstalling ? (
                <Spinner className="size-3" data-icon="inline-start" />
              ) : null}
              Install dependencies
            </Button>
            {environment.output === null ? null : (
              <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
                {environment.output}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
