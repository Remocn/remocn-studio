"use client";

import { ImageIcon, XIcon } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { mediaLabel } from "@/lib/studio/attachments";
import type { PromptAttachment } from "@/shared/ipc";

export function AttachmentRow({
  items,
  onRemove,
}: {
  items: readonly PromptAttachment[];
  onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AttachmentGroup>
      {items.map((item) => (
        <Attachment key={item.path} size="sm">
          <AttachmentMedia>
            <ImageIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{item.name}</AttachmentTitle>
            <AttachmentDescription>
              {mediaLabel(item.mediaType)}
            </AttachmentDescription>
          </AttachmentContent>
          {onRemove ? (
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${item.name}`}
                onClick={onRemove}
                value={item.path}
              >
                <XIcon />
              </AttachmentAction>
            </AttachmentActions>
          ) : null}
        </Attachment>
      ))}
    </AttachmentGroup>
  );
}
