"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  ImagePlusIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { type Sidecar, useSidecar } from "@/hooks/use-sidecar";
import { CLAUDE_MODELS } from "@/lib/studio/models";
import {
  type ContextUsage,
  SESSION_MODE_LABELS,
  SESSION_MODES,
  type SessionMode,
} from "@/shared/ipc";
import { AttachmentRow } from "./attachment-row";
import { ContextMeter } from "./context-meter";
import { MessageText } from "./message-text";
import { SelectionRow } from "./selection-row";
import { useStudio } from "./studio-provider";

const DEFAULT = "";

const MODES = SESSION_MODES.map((mode) => ({
  label: SESSION_MODE_LABELS[mode],
  value: mode,
}));

const EFFORTS = [
  { label: "Default", value: DEFAULT },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra high", value: "xhigh" },
  { label: "Max", value: "max" },
];

function ComposerBlock({
  context,
  cwd,
  disabled,
  isRunning,
  isWaiting,
  mode,
  onModeChange,
  onStop,
}: {
  context: ContextUsage | null;
  cwd: string | null;
  disabled: boolean;
  isRunning: boolean;
  isWaiting: boolean;
  mode: SessionMode;
  onModeChange: (value: string) => void;
  onStop: () => void;
}) {
  const {
    claudeEffort,
    claudeModel,
    composer,
    onEffortChange,
    onModelChange,
    tools,
  } = useStudio();
  const sidecar = useSidecar();
  const isLocked = disabled || isWaiting;
  const cannotSend = isLocked || sidecar.phase === "down";

  return (
    <div className="relative z-10 shrink-0 px-4 pb-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-1">
        <InputGroup className="rounded-xl border-none">
          {composer.attachments.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <AttachmentRow
                items={composer.attachments.items}
                onRemove={composer.onRemove}
              />
            </InputGroupAddon>
          ) : null}

          {composer.selections.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <SelectionRow
                cwd={cwd}
                items={composer.selections.items}
                onRemove={composer.onRemoveSelection}
                onSeek={tools.inspect.seek}
              />
            </InputGroupAddon>
          ) : null}

          <div className="relative flex w-full min-w-0 flex-1 flex-col">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2.5 py-2 text-base md:text-sm"
              ref={composer.caret.mirror}
            >
              <MessageText counts={composer.counts} text={composer.value} />
            </div>

            <InputGroupTextarea
              aria-label="Message Claude"
              className="relative max-h-64 text-transparent caret-foreground selection:bg-primary/30"
              disabled={isLocked}
              onChange={composer.onChange}
              onKeyDown={composer.onKeyDown}
              onPaste={composer.onPaste}
              onScroll={composer.caret.onScroll}
              placeholder={
                isWaiting
                  ? "Answer the approval request to continue…"
                  : "Describe the scene you want to build…"
              }
              ref={composer.caret.ref}
              rows={2}
              value={composer.value}
            />
          </div>

          <InputGroupAddon align="block-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <InputGroupButton
                    aria-label="Add to this message"
                    disabled={isLocked}
                    size="icon-xs"
                    variant="ghost"
                  />
                }
              >
                <PlusIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={composer.add}>
                    <ImagePlusIcon />
                    Add image
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="ml-auto flex items-center gap-1">
              {context === null ? null : <ContextMeter usage={context} />}

              <MenuChip
                icon={ShieldIcon}
                items={MODES}
                label={labelOf(MODES, mode)}
                onChange={onModeChange}
                title="Mode"
                value={mode}
              />

              <MenuChip
                icon={SparklesIcon}
                items={CLAUDE_MODELS}
                label={labelOf(CLAUDE_MODELS, claudeModel)}
                onChange={onModelChange}
                title="Model"
                value={claudeModel}
              />

              <MenuChip
                icon={SettingsIcon}
                items={EFFORTS}
                label={labelOf(EFFORTS, claudeEffort)}
                onChange={onEffortChange}
                title="Effort"
                value={claudeEffort}
              />

              {isRunning ? (
                <InputGroupButton
                  onClick={onStop}
                  size="icon-sm"
                  variant="outline"
                >
                  <SquareIcon />
                  <span className="sr-only">Stop</span>
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  disabled={cannotSend || !composer.canSubmit}
                  onClick={composer.submit}
                  size="icon-sm"
                  variant="default"
                >
                  <ArrowUpIcon />
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              )}
            </div>
          </InputGroupAddon>
        </InputGroup>

        <p
          className="flex min-h-5 items-center px-3 text-muted-foreground text-xs"
          role="status"
        >
          <ComposerStatus
            error={composer.attachments.error}
            sidecar={sidecar}
          />
        </p>
      </div>
    </div>
  );
}

export const Composer = memo(ComposerBlock);

function MenuChip({
  icon: Icon,
  items,
  label,
  onChange,
  title,
  value,
}: {
  icon: typeof SparklesIcon;
  items: readonly { label: string; value: string }[];
  label: string;
  onChange: (value: string) => void;
  title: string;
  value: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton aria-label={`${title}: ${label}`} variant="ghost" />
        }
      >
        <Icon />
        {label}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={onChange}
            value={value ?? DEFAULT}
          >
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function labelOf(
  items: readonly { label: string; value: string }[],
  value: string | null
): string {
  const found = items.find((item) => item.value === (value ?? DEFAULT));
  return found?.label ?? value ?? "Default";
}

function ComposerStatus({
  error,
  sidecar,
}: {
  error: string | null;
  sidecar: Sidecar;
}) {
  if (error !== null) {
    return <span className="text-destructive">{error}</span>;
  }

  if (sidecar.phase === "down") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        The sidecar is not running.
        <Button
          className="h-auto p-0 text-destructive text-xs"
          onClick={sidecar.restart}
          size="xs"
          variant="link"
        >
          Restart it
        </Button>
      </span>
    );
  }

  if (sidecar.phase === "starting" || sidecar.phase === "restarting") {
    return (
      <span className="flex items-center gap-2">
        <Spinner className="size-3" />
        Starting the sidecar…
      </span>
    );
  }

  return null;
}
