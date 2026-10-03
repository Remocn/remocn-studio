"use client";

import {
  AlertTriangleIcon,
  ArrowUpCircleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RotateCwIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCopyCommand } from "@/hooks/use-copy-command";
import type { Environment } from "@/hooks/use-environment";
import { useOnline } from "@/hooks/use-online";
import { usePlatform } from "@/hooks/use-platform";
import { usePresence } from "@/hooks/use-presence";
import {
  downloadPercent,
  NODE_DOWNLOAD_URL,
  troubleHeading,
} from "@/lib/studio/environment";
import { cn } from "@/lib/utils";
import type { EnvironmentCheck, EnvironmentState } from "@/shared/ipc";
import { isAgentProvider } from "@/shared/providers";
import { AboveComposer, NoticeCard } from "./notice-card";
import { ProviderSteps } from "./provider-steps";

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
  warn: "text-warning-foreground",
} satisfies Record<EnvironmentState, string>;

export function EnvironmentChecklist({
  environment: current,
}: {
  environment: Environment;
}) {
  const { copied, onCopy } = useCopyCommand();
  const presence = usePresence(
    current.troubles.length === 0 && current.error === null ? null : current
  );
  const environment = presence.shown;

  if (environment === null) {
    return null;
  }

  return (
    <AboveComposer isLeaving={presence.isLeaving}>
      <NoticeCard aria-label="Environment checklist">
        <header className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-xs">
            {troubleHeading(environment.troubles)}
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
      </NoticeCard>
    </AboveComposer>
  );
}

function NodeFix({ environment }: { environment: Environment }) {
  const platform = usePlatform();

  return platform === "mac" ? (
    <NodeInstallerFix environment={environment} />
  ) : (
    <NodeDownloadFix environment={environment} />
  );
}

// macOS: the studio fetches the official .pkg and opens it.
function NodeInstallerFix({ environment }: { environment: Environment }) {
  const online = useOnline();
  const percent = downloadPercent(environment.download);

  if (!online) {
    return (
      <p className="text-muted-foreground text-xs leading-snug">
        You are offline, so the studio cannot fetch the Node.js installer.
        Connect and press Recheck.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={environment.isInstallingNode}
        onClick={environment.installNode}
        size="xs"
        variant="outline"
      >
        {environment.isInstallingNode ? (
          <Spinner className="size-3" data-icon="inline-start" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        Install Node.js
      </Button>
      {environment.isInstallingNode ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {percent === null ? "Downloading…" : `Downloading… ${percent}%`}
        </span>
      ) : null}
    </div>
  );
}

// Linux: there is no system installer to hand a package to, so the button
// opens the download page.
function NodeDownloadFix({ environment }: { environment: Environment }) {
  const online = useOnline();

  if (!online) {
    return (
      <p className="text-muted-foreground text-xs leading-snug">
        You are offline, so the Node.js download page cannot be reached. Connect
        and press Recheck.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button
          onClick={environment.installNode}
          size="xs"
          title={NODE_DOWNLOAD_URL}
          variant="outline"
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Install Node.js
        </Button>
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        Opens the Node.js download page. Your distribution’s package manager, or
        a version manager such as mise or nvm, installs it too.
      </p>
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
            <code className="select-text rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
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

        {check.fix?.type === "provider" && isAgentProvider(check.id) ? (
          <ProviderSteps provider={check.id} row={check} />
        ) : null}

        {check.fix?.type === "node" ? (
          <NodeFix environment={environment} />
        ) : null}

        {check.fix?.type === "upgrade" ? (
          <div className="flex items-center gap-2">
            <Button
              disabled={environment.isUpgrading}
              onClick={environment.upgrade}
              size="xs"
              variant="outline"
            >
              {environment.isUpgrading ? (
                <Spinner className="size-3" data-icon="inline-start" />
              ) : (
                <ArrowUpCircleIcon data-icon="inline-start" />
              )}
              Upgrade Remotion
            </Button>
            {environment.output === null ? null : (
              <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
                {environment.output}
              </span>
            )}
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
