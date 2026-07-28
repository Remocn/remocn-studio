"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { useCallback, useMemo, useState } from "react";
import { type Attachments, useAttachments } from "@/hooks/use-attachments";
import { type Caret, useCaret } from "@/hooks/use-caret";
import { imageFilesOf } from "@/lib/studio/clipboard";
import type { PromptAttachment } from "@/shared/ipc";
import {
  dropReference,
  dropReferences,
  insertReferences,
  lostReferences,
  type ReferenceSpan,
  referenceAt,
} from "@/shared/references";

export interface Composer {
  add: () => Promise<void>;
  attachments: Attachments;
  canSubmit: boolean;
  caret: Caret;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  submit: () => void;
  value: string;
}

function deleting(
  event: KeyboardEvent<HTMLTextAreaElement>,
  count: number
): ReferenceSpan | null {
  const forward = event.key === "Delete";
  const field = event.currentTarget;

  if (
    (!forward && event.key !== "Backspace") ||
    event.altKey ||
    event.metaKey ||
    field.selectionStart !== field.selectionEnd
  ) {
    return null;
  }

  return referenceAt(field.value, count, field.selectionStart, forward);
}

export function useComposer(
  onSubmit: (text: string, attachments: readonly PromptAttachment[]) => void
): Composer {
  const [value, setValue] = useState("");
  const attachments = useAttachments();
  const caret = useCaret();
  const canSubmit = value.trim().length > 0 || attachments.items.length > 0;

  const refer = useCallback(
    (at: number, first: number, count: number) => {
      const field = caret.ref.current;
      if (count === 0 || field === null) {
        return;
      }

      const next = insertReferences(field.value, at, first, count);
      caret.moveTo(next.caret);
      setValue(next.text);
    },
    [caret]
  );

  const add = useCallback(async () => {
    const at = caret.ref.current?.selectionStart ?? 0;
    const first = attachments.items.length;
    refer(at, first, await attachments.add());
  }, [attachments, caret, refer]);

  const onPaste = useCallback(
    async (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = imageFilesOf(event.clipboardData);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      const at = event.currentTarget.selectionStart;
      const first = attachments.items.length;
      refer(at, first, await attachments.attach(files));
    },
    [attachments, refer]
  );

  const onRemove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.value);
      setValue(
        (current) =>
          dropReference(current, index, attachments.items.length).text
      );
      attachments.removeAt(index);
    },
    [attachments]
  );

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    onSubmit(value, attachments.items);
    setValue("");
    attachments.clear();
  }, [attachments, canSubmit, onSubmit, value]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      const gone = lostReferences(value, next, attachments.items.length);

      if (gone.length === 0) {
        setValue(next);
        return;
      }

      const at = event.target.selectionStart;
      const settled = dropReferences(next, gone, attachments.items.length);

      for (const index of [...gone].reverse()) {
        attachments.removeAt(index);
      }

      caret.moveTo(Math.min(at, settled.length));
      setValue(settled);
    },
    [attachments, caret, value]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
        return;
      }

      const span = deleting(event, attachments.items.length);
      if (span === null) {
        return;
      }

      event.preventDefault();
      const dropped = dropReference(
        event.currentTarget.value,
        span.index,
        attachments.items.length,
        span.start
      );

      caret.moveTo(dropped.caret);
      setValue(dropped.text);
      attachments.removeAt(span.index);
    },
    [attachments, caret, submit]
  );

  return useMemo(
    () => ({
      add,
      attachments,
      canSubmit,
      caret,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      submit,
      value,
    }),
    [
      add,
      attachments,
      canSubmit,
      caret,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      submit,
      value,
    ]
  );
}
