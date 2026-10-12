"use client";

import { memo, useCallback } from "react";
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
  type SparklesIcon,
  SquareIcon,
} from "@/components/icons";
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
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useKeepAttachment } from "@/hooks/use-keep-attachment";
import { type Sidecar, useSidecar } from "@/hooks/use-sidecar";
import { SAVE_SCENE_PROMPT } from "@/lib/studio/library";
import { modeChoices, runningModeLabel } from "@/lib/studio/models";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import { cn } from "@/lib/utils";
import type { ContextUsage, SessionMode } from "@/shared/ipc";
import { type AgentProvider, capabilitiesOf } from "@/shared/providers";
import { AssetRow } from "./asset-row";
import { ContextMeter } from "./context-meter";
import { DOCK_ACTIONS, DOCK_INSET, DOCK_SURFACE } from "./dock-layout";
import { MediaRow } from "./media-row";
import { MentionPopup } from "./mention-popup";
import { MessageText } from "./message-text";
import { ModelMenu } from "./model-menu";
import { SelectionRow } from "./selection-row";
import { useStudio, useStudioComposer } from "./studio-provider";

const DEFAULT = "";

const LINE_BOX_TERMINATOR = "\u200b";

// A message carrying values the studio would write cannot go out while a turn
// is rewriting the same files. There is no queue for it: the button says why,
// and the message waits where it was typed.
function heldBack(
  reason: string | null,
  selections: readonly { writes: readonly unknown[] }[]
): string | null {
  return reason !== null && selections.some((item) => item.writes.length > 0)
    ? reason
    : null;
}

const COLLAPSE = {
  early: "@max-md/composer:hidden",
  late: "@max-[23rem]/composer:hidden",
} as const;

const EFFORTS = [
  { label: "Default", value: DEFAULT },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra high", value: "xhigh" },
  { label: "Max", value: "max" },
];

function ComposerBlock({
  canPickProvider,
  context,
  cwd,
  disabled,
  isRunning,
  isWaiting,
  mode,
  onModeChange,
  onProviderChange,
  onStop,
  provider,
  writesBlocked = null,
}: {
  canPickProvider: boolean;
  context: ContextUsage | null;
  cwd: string | null;
  disabled: boolean;
  isRunning: boolean;
  isWaiting: boolean;
  mode: SessionMode;
  onModeChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onStop: () => void;
  provider: AgentProvider;
  writesBlocked?: string | null;
}) {
  const {
    accounts,
    claudeEffort,
    drops,
    library,
    models,
    onEffortChange,
    onPickModel,
    settingsView,
    tools,
  } = useStudio();
  const composer = useStudioComposer();
  const sidecar = useSidecar();
  const onKeepAttachment = useKeepAttachment(
    composer.attachments.items,
    library.save
  );
  const onKeepMedia = useKeepAttachment(composer.media.items, library.save);
  const { write } = composer;
  const onSaveScene = useCallback(() => write(SAVE_SCENE_PROMPT), [write]);
  const isLocked = disabled || isWaiting;
  const held = heldBack(writesBlocked, composer.selections.items);
  const cannotSend = isLocked || held !== null || sidecar.phase === "down";
  const capabilities = capabilitiesOf(provider);
  const modes = modeChoices(provider, mode, models[provider]);

  const pickModel = useCallback(
    (picked: AgentProvider, value: string) => {
      onPickModel(picked, value);
      if (picked !== provider) {
        onProviderChange(picked);
      }
    },
    [onPickModel, onProviderChange, provider]
  );

  return (
    <div className={cn("relative z-10", DOCK_INSET)}>
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-1">
        <MentionPopup mentions={composer.mentions} />

        <InputGroup
          className={cn(
            DOCK_SURFACE,
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
                onOpen={tools.inspect.openSelection}
                onRemove={composer.onRemoveSelection}
                onReset={tools.inspect.resetSelection}
                onSeek={tools.inspect.seek}
              />
            </InputGroupAddon>
          ) : null}

          <div className="relative flex w-full min-w-0 flex-1 flex-col">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-[calc(--spacing(3)-1px)] text-base [scrollbar-gutter:stable] sm:text-sm"
              ref={composer.caret.mirror}
            >
              <MessageText counts={composer.counts} text={composer.value} />
              {LINE_BOX_TERMINATOR}
            </div>

            <textarea
              {...VERBATIM_INPUT}
              aria-label="Message"
              className="field-sizing-content relative max-h-64 w-full rounded-none border-0 bg-transparent px-3 py-[calc(--spacing(3)-1px)] text-base text-transparent caret-foreground shadow-none outline-none [scrollbar-gutter:stable] selection:bg-primary/30 placeholder:text-muted-foreground/72 sm:text-sm dark:placeholder:text-muted-foreground"
              data-slot="textarea"
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
              rows={1}
              value={composer.value}
            />
          </div>

          <InputGroupAddon align="block-end">
            <div className={cn(DOCK_ACTIONS, "@container/composer min-w-0")}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="Add to this message"
                      className="relative after:absolute after:-inset-1"
                      disabled={isLocked}
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <PlusIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-auto min-w-56">
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

              <div className="ml-auto flex min-w-0 items-center gap-1">
                {context === null ? null : <ContextMeter usage={context} />}

                {capabilities.modes ? (
                  <MenuChip
                    collapse="late"
                    hint={modes.hint}
                    icon={ShieldIcon}
                    items={modes.items}
                    label={runningModeLabel(modes.running)}
                    onChange={onModeChange}
                    title="Mode"
                    value={mode}
                  />
                ) : null}

                <ModelMenu
                  accounts={accounts.rows}
                  canPickProvider={canPickProvider}
                  models={models}
                  onPick={pickModel}
                  onSignIn={settingsView.openAccounts}
                  provider={provider}
                />

                {capabilities.effort ? (
                  <MenuChip
                    collapse="early"
                    icon={SettingsIcon}
                    items={EFFORTS}
                    label={labelOf(EFFORTS, claudeEffort)}
                    onChange={onEffortChange}
                    title="Effort"
                    value={claudeEffort}
                  />
                ) : null}

                {isRunning ? (
                  <>
                    {composer.canSubmit ? (
                      <Button
                        aria-label="Queue"
                        className="gap-1"
                        disabled={cannotSend}
                        onClick={composer.submit}
                        size="sm"
                        title={held ?? "Queue this message"}
                        variant="outline"
                      >
                        <ListPlusIcon />
                        <span className={COLLAPSE.early}>Queue</span>
                      </Button>
                    ) : null}
                    <Button onClick={onStop} size="icon-sm" variant="outline">
                      <SquareIcon />
                      <span className="sr-only">Stop</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={cannotSend || !composer.canSubmit}
                    onClick={composer.submit}
                    size="icon-sm"
                    title={held ?? undefined}
                    variant="default"
                  >
                    <ArrowUpIcon />
                    <span className="sr-only">Send</span>
                  </Button>
                )}
              </div>
            </div>
          </InputGroupAddon>
        </InputGroup>

        <p
          className="flex min-h-5 items-center px-3 text-muted-foreground text-xs empty:hidden"
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
  collapse,
  hint = null,
  icon: Icon,
  items,
  label,
  onChange,
  title,
  value,
}: {
  collapse: keyof typeof COLLAPSE;
  hint?: string | null;
  icon: typeof SparklesIcon;
  items: readonly ChipItem[];
  label: string;
  onChange: (value: string) => void;
  title: string;
  value: string | null;
}) {
  const said =
    hint === null ? `${title}: ${label}` : `${title}: ${label} — ${hint}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={said} size="sm" title={said} variant="ghost" />
        }
      >
        <Icon />
        <span className={COLLAPSE[collapse]}>{label}</span>
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={onChange}
            value={value ?? DEFAULT}
          >
            {items.map((item) => (
              <DropdownMenuRadioItem
                closeOnClick
                disabled={item.disabled}
                key={item.value}
                title={item.hint}
                value={item.value}
              >
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ChipItem {
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly label: string;
  readonly value: string;
}

function labelOf(items: readonly ChipItem[], value: string | null): string {
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
    return (
      <span className="text-foreground">Drop to attach to this message</span>
    );
  }

  if (error !== null) {
    return <span className="text-destructive">{error}</span>;
  }

  if (sidecar.phase === "down") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        The studio's helper is not running.
        <Button
          className="relative h-auto p-0 text-destructive text-xs after:absolute after:-inset-2"
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
        Starting the studio's helper…
      </span>
    );
  }

  return null;
}
