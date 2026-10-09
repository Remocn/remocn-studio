"use client";

import { CornerDownLeftIcon, LibraryBigIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useComment } from "@/hooks/use-comment";
import { useElementSize } from "@/hooks/use-element-size";
import type { Marker, PendingComment } from "@/hooks/use-inspect";
import { relativeTo } from "@/lib/studio/activity";
import { boxOf, cardPlacement } from "@/lib/studio/card";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import type { PromptElement } from "@/shared/ipc";

const COMPACT_CARD = { height: 148, width: 288 };

export function InspectOverlay({
  card,
  cwd,
  markers,
  onCancel,
  onSubmit,
}: {
  card: PendingComment | null;
  cwd: string | null;
  markers: readonly Marker[];
  onCancel: () => void;
  onSubmit: (comment: string) => void;
}) {
  const stage = useElementSize<HTMLDivElement>();

  return (
    <div className="pointer-events-none absolute inset-0 z-10" ref={stage.ref}>
      {markers.map((marker) => (
        <ElementMarker key={marker.id} marker={marker} />
      ))}

      {/* A tunable element is answered by the properties pane, which has the
          room this card never had; the card stays for everything else. */}
      {card === null || card.tuning !== null ? null : (
        <CommentCard
          card={card}
          cwd={cwd}
          onCancel={onCancel}
          onSubmit={onSubmit}
          placement={cardPlacement(
            boxOf(card.rect, stage.size),
            stage.size,
            COMPACT_CARD
          )}
        />
      )}
    </div>
  );
}

function ElementMarker({ marker }: { marker: Marker }) {
  return (
    <div
      className="absolute rounded-sm border border-reference/80 bg-reference/10"
      style={{
        height: `${marker.rect.height * 100}%`,
        left: `${marker.rect.x * 100}%`,
        top: `${marker.rect.y * 100}%`,
        width: `${marker.rect.width * 100}%`,
      }}
    >
      <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-reference font-medium text-2xs text-background tabular-nums">
        {marker.index + 1}
      </span>
    </div>
  );
}

function CommentCard({
  card,
  cwd,
  onCancel,
  onSubmit,
  placement,
}: {
  card: PendingComment;
  cwd: string | null;
  onCancel: () => void;
  onSubmit: (comment: string) => void;
  placement: { x: number; y: number };
}) {
  const comment = useComment(onSubmit, onCancel);
  const { element } = card;

  return (
    <div
      className="surface-floating pointer-events-auto absolute flex flex-col gap-2 p-2"
      data-canvas-chrome
      style={{
        left: `${placement.x}px`,
        top: `${placement.y}px`,
        width: `${COMPACT_CARD.width}px`,
      }}
    >
      <p
        className="truncate px-1 text-muted-foreground text-xs"
        title={whereOf(element, cwd)}
      >
        <span className="text-foreground">
          {element.component ?? "This element"}
        </span>
        {" · "}
        {whereOf(element, cwd)}
      </p>

      <Textarea
        {...VERBATIM_INPUT}
        aria-label="What should change about this element?"
        className="max-h-24 min-h-14 resize-none text-sm"
        onChange={comment.onChange}
        onKeyDown={comment.onKeyDown}
        placeholder="What should change?"
        ref={comment.ref}
        rows={2}
        value={comment.value}
      />

      <div className="flex items-center gap-1">
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
        <div className="ml-auto flex items-center gap-1">
          <Button onClick={onCancel} size="xs" variant="ghost">
            Cancel
          </Button>
          <Button onClick={comment.submit} size="xs">
            <CornerDownLeftIcon />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function whereOf(element: PromptElement, cwd: string | null): string {
  if (element.file === null) {
    return "no source";
  }

  const shown = relativeTo(element.file, cwd);

  return element.line === null ? shown : `${shown}:${element.line}`;
}
