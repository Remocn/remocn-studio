"use client";

import { SpringVisualization } from "dialkit";
import { useCallback } from "react";
import {
  ChevronRightIcon,
  CornerDownLeftIcon,
  LibraryBigIcon,
  PlayIcon,
  RotateCcwIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComment } from "@/hooks/use-comment";
import type { DeletionTarget } from "@/hooks/use-deletion";
import {
  isFieldAnimated,
  isTextChanged,
  type PendingComment,
  type TextDraft,
  type TuningRefusal,
} from "@/hooks/use-inspect";
import { type PreviewFrames, usePreviewFrame } from "@/hooks/use-preview";
import { type PropGroups, usePropGroups } from "@/hooks/use-prop-groups";
import { useTimeStrip } from "@/hooks/use-time-strip";
import { useWheelScroll } from "@/hooks/use-wheel-scroll";
import { windowSeconds } from "@/lib/studio/easing";
import type {
  PreviewWindow,
  TuningField,
  TuningTarget,
} from "@/lib/studio/preview";
import { paneRows, type SpringReadout } from "@/lib/studio/spring";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import { changedFields, subtitleOf, titleOf } from "@/lib/studio/tuning";
import { cn } from "@/lib/utils";
import type { TuningValue } from "@/shared/ipc";
import { DeleteAction } from "./delete-action";
import { DialKitSurface } from "./dialkit-surface";
import { DOCK_ACTIONS, DOCK_INSET, DOCK_SURFACE } from "./dock-layout";
import { ManagedPropsPane } from "./managed-props-pane";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { GroupHeading } from "./prop-group-heading";
import { useStudio } from "./studio-provider";
import { TuningRow } from "./tuning-controls";

// A design tool's order: where the thing is, how it is composited, how it
// reads, what it is painted with, then its own parameters and its timing.
const GROUP_ORDER = [
  "Transform",
  "Layer",
  "Typography",
  "Fill",
  "Stroke",
  "Parameters",
  "Entry",
  "Exit",
  "Effects",
  "Timing",
];

export function PropsPane() {
  const { composerActions, openedProject, settings, tools } = useStudio();
  const { inspect } = tools;
  const { card } = inspect;
  // Outside the keyed panel below, so a fold survives picking another element.
  const groups = usePropGroups(settings);

  const addManagedInstruction = useCallback(
    (instruction: string) => {
      const object = tools.managed?.selected;
      const video = tools.preview.composition;
      if (!(object && video)) {
        return;
      }
      composerActions.write(
        `For element ${JSON.stringify(object.label)} (studio object ${JSON.stringify(object.id)}, definition ${JSON.stringify(object.definition)}) in video ${JSON.stringify(video)}:\n${instruction}`
      );
      composerActions.caret.ref.current?.focus();
    },
    [composerActions, tools.managed?.selected, tools.preview.composition]
  );

  if (tools.managed?.isOpen) {
    return (
      <ManagedPropsPane
        deletion={tools.deletion.target}
        fps={tools.preview.pick?.metadata?.fps}
        groups={groups}
        key={`${openedProject?.id}:${tools.preview.composition}`}
        objects={tools.managed}
        onAddInstruction={addManagedInstruction}
        onDelete={tools.deletion.remove}
      />
    );
  }

  if (card === null || card.tuning === null) {
    return null;
  }

  return (
    <PropsPanel
      card={card}
      cwd={openedProject?.path ?? null}
      deletion={tools.deletion.target}
      frames={tools.preview}
      groups={groups}
      key={card.targets.at(0)?.instanceId || "element"}
      onCancel={inspect.cancelComment}
      onChange={inspect.changeTuning}
      onChangeText={inspect.changeText}
      onDelete={tools.deletion.remove}
      onOpenTarget={inspect.openTarget}
      onReplay={inspect.replay}
      onReset={inspect.resetTuning}
      onSeek={inspect.seekTo}
      onSubmit={inspect.submitComment}
      refusal={inspect.tuningRefusal}
      target={card.tuning}
    />
  );
}

export function PropsPanel({
  card,
  cwd,
  deletion = null,
  frames,
  groups: folds,
  onCancel,
  onChange,
  onChangeText,
  onDelete,
  onOpenTarget,
  onReplay,
  onReset,
  onSeek,
  onSubmit,
  refusal,
  target,
}: {
  card: PendingComment;
  cwd: string | null;
  deletion?: DeletionTarget | null;
  frames: PreviewFrames;
  /** Which sections are folded shut, and how to fold one. */
  groups?: PropGroups;
  onCancel: () => void;
  onChange: (path: string, value: TuningValue) => void;
  onChangeText: (value: string) => void;
  onDelete?: () => void;
  onOpenTarget?: (index: number) => void;
  onReplay: () => void;
  onReset: (paths?: readonly string[]) => void;
  onSeek: (frame: number) => void;
  onSubmit: (comment: string) => void;
  refusal: TuningRefusal | null;
  target: TuningTarget;
}) {
  const comment = useComment(onSubmit, onCancel);
  const changes = countChanges(card);
  const groups = groupsOf(target.fields);
  const resetAll = useCallback(() => onReset(), [onReset]);
  const subtitle = subtitleOf(target, card.targets[card.open + 1] ?? null, cwd);
  const duration = windowSeconds(card.window, card.element.fps);
  const assets = {
    base: card.assetBase ?? null,
    names: card.assets ?? [],
  };

  return (
    <Pane className="property-inspector">
      <PaneHeader>
        <div className="flex min-w-0 items-center gap-2">
          <PaneTitle className="truncate">{titleOf(target)}</PaneTitle>
          {target.instances < 2 ? null : (
            <span
              className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums"
              title={`One of ${target.instances} rendered from this call site`}
            >
              {target.ordinal} of {target.instances}
            </span>
          )}
        </div>
        <PaneActions>
          {onDelete === undefined ? null : (
            <DeleteAction onDelete={onDelete} target={deletion} />
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Clear selection and restore original values"
                  className="text-muted-foreground"
                  onClick={onCancel}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <XIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear selection and restore the original values
            </TooltipContent>
          </Tooltip>
        </PaneActions>
      </PaneHeader>

      <PaneBody className="gap-0 p-0">
        <TimeStripRow
          frames={frames}
          onReplay={onReplay}
          onSeek={onSeek}
          span={card.window ?? null}
        />

        {target.instances < 2 ? null : (
          <p className="px-4 pb-2 text-muted-foreground text-xs">
            Shared by {target.instances} · a change here moves all of them
          </p>
        )}

        {card.targets.length < 2 || onOpenTarget === undefined ? null : (
          <TargetChain
            onOpen={onOpenTarget}
            open={card.open}
            targets={card.targets}
          />
        )}

        <div className="flex min-h-8 shrink-0 items-center gap-2 px-4 pb-2">
          <p
            className="min-w-0 flex-1 truncate text-muted-foreground text-xs"
            title={subtitle}
          >
            {subtitle}
          </p>
          {changes === 0 ? null : (
            <Button
              className="shrink-0 text-muted-foreground"
              onClick={resetAll}
              size="xs"
              variant="ghost"
            >
              <RotateCcwIcon />
              Reset all
            </Button>
          )}
        </div>

        <DialKitSurface
          key={card.tuning?.targetId ?? "untunable"}
          targetId={card.tuning?.targetId ?? "untunable"}
        >
          <ScrollArea className="min-h-0 flex-1">
            <div className="pb-4">
              {card.text === null || card.text === undefined ? null : (
                <TextSection onChange={onChangeText} text={card.text} />
              )}
              {groups.map(([group, grouped]) => (
                <section className="px-4 py-3" key={group}>
                  <GroupHeading
                    count={grouped.length}
                    group={group}
                    isOpen={!folds?.collapsed.includes(group)}
                    onToggle={folds?.toggle}
                  />
                  <div
                    className="flex flex-col gap-1.5"
                    hidden={folds?.collapsed.includes(group) === true}
                  >
                    {paneRows(grouped).map((row) =>
                      row.kind === "spring" ? (
                        <SpringResponse
                          key={`spring:${row.spring.prefix}`}
                          spring={row.spring}
                        />
                      ) : (
                        <TuningRow
                          animated={isFieldAnimated(card, row.field)}
                          assets={assets}
                          duration={duration}
                          field={row.field}
                          fonts={card.fonts}
                          key={row.field.path}
                          onChange={onChange}
                          onReset={onReset}
                          original={
                            card.originals[row.field.targetId]?.[row.field.path]
                          }
                          refusal={refusalFor(refusal, row.field)}
                        />
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
        </DialKitSurface>

        <div className={cn(DOCK_INSET, "flex flex-col gap-2")}>
          {refusal === null || refusal.path !== null ? null : (
            <p className="text-destructive text-xs" role="alert">
              {refusal.message}
            </p>
          )}

          <InputGroup className={DOCK_SURFACE}>
            <InputGroupTextarea
              {...VERBATIM_INPUT}
              aria-label="What should change about this element?"
              className="max-h-32 flex-1 resize-none text-sm"
              onChange={comment.onChange}
              onKeyDown={comment.onKeyDown}
              placeholder="What should change?"
              ref={comment.ref}
              rows={2}
              value={comment.value}
            />

            <InputGroupAddon align="block-end">
              <div className={cn(DOCK_ACTIONS, "flex-wrap")}>
                <Button
                  className="text-muted-foreground"
                  onClick={comment.keep}
                  size="xs"
                  title="Ask the agent to put this in the asset library"
                  variant="ghost"
                >
                  <LibraryBigIcon />
                  Save to library
                </Button>
                <div className="ms-auto flex items-center gap-1">
                  <Button onClick={onCancel} size="xs" variant="ghost">
                    Cancel
                  </Button>
                  <Button onClick={comment.submit} size="xs">
                    <CornerDownLeftIcon />
                    {changes === 0 ? "Add" : `Add ${changes}`}
                  </Button>
                </div>
              </div>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </PaneBody>
    </Pane>
  );
}

/**
 * The three numbers of a `spring()` are one movement, so the pane draws the
 * response above them rather than leaving damping, stiffness and mass to be
 * read as three unrelated dials. It is a readout and not a control: dialkit's
 * own `SpringControl` needs a panel registered in its store, and its Time mode
 * parameterises Motion's solver rather than Remotion's. The curve is the
 * shape; the seconds under it are dialkit's fixed window, not the scene's.
 */
function SpringResponse({ spring }: { spring: SpringReadout }) {
  return (
    <div className="dialkit-composite-control">
      <span className="dialkit-composite-label">{spring.label}</span>
      <SpringVisualization
        isSimpleMode={false}
        spring={{
          damping: spring.damping,
          mass: spring.mass,
          stiffness: spring.stiffness,
          type: "spring",
        }}
      />
    </div>
  );
}

function TextSection({
  onChange,
  text,
}: {
  onChange: (value: string) => void;
  text: TextDraft;
}) {
  const write = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.currentTarget.value);
    },
    [onChange]
  );

  return (
    <section className="px-4 py-3">
      <h3 className="pb-2 font-medium text-foreground text-sm">Text</h3>
      <Textarea
        {...VERBATIM_INPUT}
        aria-label="Text"
        className="max-h-24 min-h-14 resize-none text-xs"
        onChange={write}
        rows={2}
        value={text.draft}
      />
      <p className="pt-1.5 text-2xs text-muted-foreground">
        sent to the agent, not previewed
      </p>
    </section>
  );
}

function TimeStripRow({
  frames,
  onReplay,
  onSeek,
  span,
}: {
  frames: PreviewFrames;
  onReplay: () => void;
  onSeek: (frame: number) => void;
  span: PreviewWindow | null;
}) {
  const frame = usePreviewFrame(frames);
  const strip = useTimeStrip({ frame, onReplay, onSeek, span });

  return (
    <div className="flex min-h-8 shrink-0 items-center gap-2 px-4 pb-2">
      <span className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
        {strip.label}
      </span>

      {strip.span === null ? null : (
        <input
          aria-label="Frame"
          className="control-surface h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
          max={strip.max}
          min={strip.min}
          onChange={strip.onSeek}
          step={1}
          type="range"
          value={Math.min(Math.max(strip.frame, strip.min), strip.max)}
        />
      )}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-disabled={!strip.canReplay}
              className="ml-auto shrink-0 text-muted-foreground aria-disabled:opacity-50"
              onClick={strip.replay}
              size="xs"
              variant="ghost"
            />
          }
        >
          <PlayIcon />
          Replay
        </TooltipTrigger>
        <TooltipContent side="bottom">{strip.tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * The `Interactive`s around what was clicked, innermost first.
 *
 * Remotion's markup primitives nest inside the component that renders them, so
 * pointing at a word lands on an `Interactive.Div` while the component's own
 * parameters — its easing, its timing — sit one or more levels out. Folding
 * them all into one list was the first answer and it was wrong: selecting a
 * title then showed the parameters of the camera framing the whole scene. So
 * the chain is offered instead, and the pane opens on what was actually
 * pointed at.
 */
function TargetChain({
  onOpen,
  open,
  targets,
}: {
  onOpen: (index: number) => void;
  open: number;
  targets: readonly TuningTarget[];
}) {
  // The index rides on the button rather than in a closure, so the row does
  // not remint a handler per target on every render.
  const choose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onOpen(Number(event.currentTarget.value));
    },
    [onOpen]
  );

  // A wheel travels sideways here: the strip only scrolls that way, and with
  // no scrollbar to grab a plain mouse would otherwise have no way to reach
  // the chips clipped off the edge.
  const strip = useWheelScroll<HTMLElement>();

  return (
    // A strip of chips scrolls without a bar, the way the attachment row does:
    // at this height a native scrollbar is most of the strip, and the cue is
    // the chip itself, clipped at the edge.
    <nav
      aria-label="Which component to edit"
      className="scrollbar-none flex shrink-0 items-center gap-0.5 overflow-x-auto px-4 pb-2"
      ref={strip.ref}
    >
      {targets.map((target, index) => (
        <span className="flex items-center gap-0.5" key={target.targetId}>
          {index === 0 ? null : (
            <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
          )}
          <Button
            aria-current={index === open}
            className={cn(
              "h-6 shrink-0 px-1.5 text-xs",
              index === open ? "text-foreground" : "text-muted-foreground"
            )}
            onClick={choose}
            size="xs"
            title={target.componentName}
            value={String(index)}
            variant={index === open ? "secondary" : "ghost"}
          >
            {titleOf(target)}
          </Button>
        </span>
      ))}
    </nav>
  );
}

function groupsOf(fields: readonly TuningField[]): [string, TuningField[]][] {
  const grouped = Map.groupBy(fields, (field) => field.group);

  return [...grouped].sort(([first], [second]) => {
    const left = GROUP_ORDER.indexOf(first);
    const right = GROUP_ORDER.indexOf(second);

    return (
      (left === -1 ? GROUP_ORDER.length : left) -
      (right === -1 ? GROUP_ORDER.length : right)
    );
  });
}

// Every target in the chain, not only the one on screen: an edit made before
// the pane was switched still goes to the agent, so it still has to be counted.
function countChanges(card: PendingComment): number {
  return changedFields(card).length + (isTextChanged(card) ? 1 : 0);
}

function refusalFor(
  refusal: TuningRefusal | null,
  field: TuningField
): string | null {
  return refusal !== null &&
    refusal.path === field.path &&
    refusal.targetId === field.targetId
    ? refusal.message
    : null;
}
