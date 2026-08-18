"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  FilmIcon,
  ImagePlusIcon,
  LibraryBigIcon,
  ListPlusIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { memo, useCallback } from "react";
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
import { useKeepAttachment } from "@/hooks/use-keep-attachment";
import { type Sidecar, useSidecar } from "@/hooks/use-sidecar";
import { SAVE_SCENE_PROMPT } from "@/lib/studio/library";
import { CLAUDE_MODELS } from "@/lib/studio/models";
import { cn } from "@/lib/utils";
import {
  type ContextUsage,
  SESSION_MODE_LABELS,
  SESSION_MODES,
  type SessionMode,
} from "@/shared/ipc";
import { AssetRow } from "./asset-row";
import { ContextMeter } from "./context-meter";
import { MediaRow } from "./media-row";
import { MentionPopup } from "./mention-popup";
import { MessageText } from "./message-text";
import { SelectionRow } from "./selection-row";
import { useStudio } from "./studio-provider";

const DEFAULT = "";

const LINE_BOX_TERMINATOR = "\u200b";

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
    drops,
    library,
    onEffortChange,
    onModelChange,
    tools,
  } = useStudio();
  const sidecar = useSidecar();
  const onKeepAttachment = useKeepAttachment(
    composer.attachments.items,
    library.save
  );
  const onKeepMedia = useKeepAttachment(composer.media.items, library.save);
  const { write } = composer;
  const onSaveScene = useCallback(() => write(SAVE_SCENE_PROMPT), [write]);
  const isLocked = disabled || isWaiting;
  const cannotSend = isLocked || sidecar.phase === "down";

  return (
    <div className="relative z-10 shrink-0 px-4 pb-4">
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-1">
        <MentionPopup mentions={composer.mentions} />

        <InputGroup
          className={cn(
            "rounded-xl border-none",
            drops.composer.isOver && "bg-primary/5 ring-2 ring-primary/40"
          )}
          ref={drops.composer.ref}
        >
          {composer.attachments.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <MediaRow
                items={composer.attachments.items}
                onKeep={onKeepAttachment}
                onRemove={composer.onRemove}
              />
            </InputGroupAddon>
          ) : null}

          {composer.media.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <MediaRow
                items={composer.media.items}
                onKeep={onKeepMedia}
                onRemove={composer.onRemoveMedia}
              />
            </InputGroupAddon>
          ) : null}

          {composer.assets.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <AssetRow
                items={composer.assets.items}
                onRemove={composer.onRemoveAsset}
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
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2.5 py-2 text-base [scrollbar-gutter:stable] md:text-sm"
              ref={composer.caret.mirror}
            >
              <MessageText counts={composer.counts} text={composer.value} />
              {LINE_BOX_TERMINATOR}
            </div>

            <InputGroupTextarea
              aria-label="Message Claude"
              className="relative max-h-64 text-transparent caret-foreground [scrollbar-gutter:stable] selection:bg-primary/30"
              disabled={isLocked}
              onBlur={composer.onBlur}
              onChange={composer.onChange}
              onKeyDown={composer.onKeyDown}
              onPaste={composer.onPaste}
              onScroll={composer.caret.onScroll}
              onSelect={composer.onSelect}
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
                  <DropdownMenuItem onClick={composer.addMedia}>
                    <FilmIcon />
                    Add video or audio
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSaveScene}>
                    <LibraryBigIcon />
                    Save the last animation to the library
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
                <>
                  {composer.canSubmit ? (
                    <InputGroupButton
                      className="h-8 gap-1 px-2.5"
                      disabled={cannotSend}
                      onClick={composer.submit}
                      size="sm"
                      variant="outline"
                    >
                      <ListPlusIcon />
                      Queue
                    </InputGroupButton>
                  ) : null}
                  <InputGroupButton
                    onClick={onStop}
                    size="icon-sm"
                    variant="outline"
                  >
                    <SquareIcon />
                    <span className="sr-only">Stop</span>
                  </InputGroupButton>
                </>
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
            isOver={drops.composer.isOver}
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
  isOver,
  sidecar,
}: {
  error: string | null;
  isOver: boolean;
  sidecar: Sidecar;
}) {
  if (isOver) {
    return <span className="text-primary">Drop to attach to this message</span>;
  }

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
