"use client";

import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  TerminalIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useCopyCommand } from "@/hooks/use-copy-command";
import { useTerminal } from "@/hooks/use-terminal";
import { terminalPasteHint } from "@/lib/studio/platform";
import {
  type SetupStage,
  type StageState,
  stageStates,
} from "@/lib/studio/setup";
import { cn } from "@/lib/utils";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  type AgentProvider,
  PROVIDER_SETUP,
  type SetupStep,
} from "@/shared/providers";

export function ProviderSteps({
  provider,
  row,
}: {
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const setup = PROVIDER_SETUP[provider];
  const stages = stageStates(row);
  const copy = useCopyCommand();
  const terminal = useTerminal();

  return (
    <ol aria-label={`Set up ${setup.cli}`} className="mt-1 flex flex-col gap-2">
      <Step
        detail={setup.note}
        stage="install"
        state={stages.install}
        step={setup.install}
        title={`Install ${setup.cli}`}
      >
        <StepActions copy={copy} step={setup.install} terminal={terminal} />
      </Step>
      <Step
        detail="A browser window opens to sign in. Use the account whose subscription you pay for."
        stage="signin"
        state={stages.signin}
        step={setup.signin}
        title="Sign in"
      >
        <StepActions copy={copy} step={setup.signin} terminal={terminal} />
      </Step>
      <Step
        detail="The studio checks again on its own when you return to it."
        stage="return"
        state={stages.return}
        step={null}
        title="Come back here"
      />
      {terminal.error === null ? null : (
        <li className="text-destructive text-xs" role="alert">
          {terminal.error}
        </li>
      )}
    </ol>
  );
}

function Step({
  children,
  detail,
  stage,
  state,
  step,
  title,
}: {
  children?: React.ReactNode;
  detail: string | null;
  stage: SetupStage;
  state: StageState;
  step: SetupStep | null;
  title: string;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-2",
        state === "todo" ? "opacity-60" : null
      )}
      data-stage={stage}
      data-state={state}
    >
      <StageMark state={state} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs leading-snug">{title}</p>
        {detail === null || state === "done" ? null : (
          <p className="text-muted-foreground text-xs leading-snug">{detail}</p>
        )}
        {step === null || state === "done" ? null : (
          <code className="select-text break-all rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
            {step.command}
          </code>
        )}
        {state === "done" ? null : (children ?? null)}
      </div>
    </li>
  );
}

function StageMark({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <CheckIcon
        aria-label="Done"
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-1 size-2.5 shrink-0 rounded-full border",
        state === "current"
          ? "border-foreground bg-foreground"
          : "border-border"
      )}
    />
  );
}

function StepActions({
  copy,
  step,
  terminal,
}: {
  copy: ReturnType<typeof useCopyCommand>;
  step: SetupStep;
  terminal: ReturnType<typeof useTerminal>;
}) {
  const onRead = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    openUrl(event.currentTarget.value).catch(() => undefined);
  }, []);

  const isOpened = terminal.opened === step.command;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={terminal.onOpen}
        size="xs"
        title="Copies the command and opens an empty window of your terminal. Nothing runs until you paste it and press Enter."
        value={step.command}
        variant="outline"
      >
        <TerminalIcon data-icon="inline-start" />
        {isOpened ? terminalPasteHint() : "Open in Terminal"}
      </Button>
      <Button
        onClick={copy.onCopy}
        size="xs"
        value={step.command}
        variant="ghost"
      >
        {copy.copied === step.command ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <CopyIcon data-icon="inline-start" />
        )}
        {copy.copied === step.command ? "Copied" : "Copy"}
      </Button>
      {step.url === null ? null : (
        <Button onClick={onRead} size="xs" value={step.url} variant="ghost">
          <ExternalLinkIcon data-icon="inline-start" />
          Instructions
        </Button>
      )}
    </div>
  );
}
