"use client";

import { CornerDownLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useComment } from "@/hooks/use-comment";
import { useElementSize } from "@/hooks/use-element-size";
import type { Marker, PendingComment } from "@/hooks/use-inspect";
import { relativeTo } from "@/lib/studio/activity";
import { boxOf, cardPlacement } from "@/lib/studio/card";
import type { PromptElement } from "@/shared/ipc";

const CARD = { height: 148, width: 288 };

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

      {card === null ? null : (
        <CommentCard
          cwd={cwd}
          element={card.element}
          onCancel={onCancel}
          onSubmit={onSubmit}
          placement={cardPlacement(
            boxOf(card.rect, stage.size),
            stage.size,
            CARD
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
      <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-reference font-medium text-[10px] text-background tabular-nums">
        {marker.index + 1}
      </span>
    </div>
  );
}

function CommentCard({
  cwd,
  element,
  onCancel,
  onSubmit,
  placement,
}: {
  cwd: string | null;
  element: PromptElement;
  onCancel: () => void;
  onSubmit: (comment: string) => void;
  placement: { x: number; y: number };
}) {
  const comment = useComment(onSubmit, onCancel);

  return (
    <div
      className="pointer-events-auto absolute flex flex-col gap-2 rounded-xl border bg-popover p-2 shadow-lg"
      style={{
        left: `${placement.x}px`,
        top: `${placement.y}px`,
        width: `${CARD.width}px`,
      }}
    >
      <p className="truncate px-1 text-muted-foreground text-xs">
        <span className="text-foreground">
          {element.component ?? "This element"}
        </span>
        {" · "}
        {whereOf(element, cwd)}
      </p>

      <Textarea
        aria-label="What should change about this element?"
        className="max-h-24 min-h-14 resize-none text-sm"
        onChange={comment.onChange}
        onKeyDown={comment.onKeyDown}
        placeholder="What should change?"
        ref={comment.ref}
        rows={2}
        value={comment.value}
      />

      <div className="flex items-center justify-end gap-1">
        <Button onClick={onCancel} size="xs" variant="ghost">
          Cancel
        </Button>
        <Button onClick={comment.submit} size="xs">
          <CornerDownLeftIcon />
          Add
        </Button>
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
