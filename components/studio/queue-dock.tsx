"use client";

import { ClockIcon, XIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useDisclosure } from "@/hooks/use-disclosure";
import type { Queue } from "@/hooks/use-queue";
import {
  type QueuedMessage,
  queuedCounts,
  queuedLabel,
} from "@/lib/studio/turns";
import { DockSection } from "./dock";
import { MessageText } from "./message-text";

function QueueDockBlock({ queue }: { queue: Queue }) {
  const disclosure = useDisclosure();
  const [next] = queue.items;

  if (next === undefined) {
    return null;
  }

  return (
    <DockSection
      count={`${queue.items.length} queued`}
      icon={<ClockIcon className="size-4 shrink-0 text-muted-foreground" />}
      isExpanded={disclosure.isOpen}
      label={<QueuedText message={next} />}
      onToggle={disclosure.toggle}
      summary={summaryOf(queue.items.length)}
    >
      <ul className="flex min-w-0 flex-col gap-0.5">
        {queue.items.map((message, index) => (
          <li className="flex min-w-0 items-start gap-1" key={message.id}>
            {/* The text wraps rather than truncating, for the reason the plan's
                rows wrap: a queue you cannot read is not a queue you can edit,
                and the block is free to grow downwards once it is open. */}
            <button
              className="wrap-break-word min-w-0 flex-1 text-pretty rounded-lg px-2 py-1.5 text-left text-sm leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 enabled:active:bg-muted enabled:hover:bg-muted/60 disabled:cursor-default"
              disabled={!queue.canEdit}
              onClick={queue.onEdit}
              title={editTitle(queue.canEdit)}
              type="button"
              value={message.id}
            >
              <QueuedText message={message} />
            </button>
            <Button
              aria-label={`Remove queued message ${index + 1}`}
              className="relative mt-1 shrink-0 text-muted-foreground after:absolute after:-inset-1"
              onClick={queue.onRemove}
              size="icon-xs"
              value={message.id}
              variant="ghost"
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
    </DockSection>
  );
}

export const QueueDock = memo(QueueDockBlock);

function QueuedText({ message }: { message: QueuedMessage }) {
  if (message.text.trim().length === 0) {
    return queuedLabel(message);
  }

  return <MessageText counts={queuedCounts(message)} text={message.text} />;
}

function summaryOf(count: number): string {
  return count === 1 ? "Queue, 1 message" : `Queue, ${count} messages`;
}

function editTitle(canEdit: boolean): string {
  return canEdit
    ? "Put this message back in the composer"
    : "Clear the composer to edit this message";
}
