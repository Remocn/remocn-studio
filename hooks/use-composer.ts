"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Attachments, useAttachments } from "@/hooks/use-attachments";
import { type Caret, useCaret } from "@/hooks/use-caret";
import { type Selections, useSelections } from "@/hooks/use-selections";
import { imageFilesOf } from "@/lib/studio/clipboard";
import type { PreviewRect } from "@/lib/studio/preview";
import type { PromptAttachment, PromptElement } from "@/shared/ipc";
import {
  dropLostReferences,
  dropReference,
  dropReferences,
  hasLostReferences,
  insertAt,
  insertReferences,
  lostReferences,
  type ReferenceCounts,
  type ReferenceSpan,
  referenceAt,
} from "@/shared/references";

export interface ComposerSettings {
  onSubmit: (
    text: string,
    attachments: readonly PromptAttachment[],
    elements: readonly PromptElement[]
  ) => void;
  projectId: string | null;
}

export interface Composer {
  add: () => Promise<void>;
  attachments: Attachments;
  canSubmit: boolean;
  capture: (file: File) => Promise<void>;
  caret: Caret;
  counts: ReferenceCounts;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSelection: (event: MouseEvent<HTMLButtonElement>) => void;
  select: (
    element: PromptElement,
    rect: PreviewRect,
    comment: string
  ) => string;
  selections: Selections;
  submit: () => void;
  value: string;
}

function deleting(
  event: KeyboardEvent<HTMLTextAreaElement>,
  counts: ReferenceCounts
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

  return referenceAt(field.value, counts, field.selectionStart, forward);
}

export function useComposer({
  onSubmit,
  projectId,
}: ComposerSettings): Composer {
  const [value, setValue] = useState("");
  const attachments = useAttachments();
  const selections = useSelections();
  const caret = useCaret();

  const counts = useMemo(
    () => ({
      element: selections.items.length,
      image: attachments.items.length,
    }),
    [attachments.items.length, selections.items.length]
  );

  const canSubmit =
    value.trim().length > 0 || counts.image > 0 || counts.element > 0;

  const refer = useCallback(
    (at: number, first: number, count: number) => {
      const field = caret.ref.current;
      if (count === 0 || field === null) {
        return;
      }

      const next = insertReferences(field.value, at, "image", first, count);
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

  const capture = useCallback(
    async (file: File) => {
      const field = caret.ref.current;
      const at = field?.selectionStart ?? field?.value.length ?? 0;
      const first = attachments.items.length;
      refer(at, first, await attachments.attach([file]));
    },
    [attachments, caret, refer]
  );

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

  const select = useCallback(
    (element: PromptElement, rect: PreviewRect, comment: string) => {
      const field = caret.ref.current;
      const text = field?.value ?? value;
      const at = field?.selectionStart ?? text.length;
      const added = selections.add(element, rect);

      const written = insertAt(text, at, comment.trim());
      const next = insertReferences(
        written.text,
        written.caret,
        "element",
        added.index,
        1
      );

      caret.moveTo(next.caret);
      setValue(next.text);

      return added.id;
    },
    [caret, selections, value]
  );

  const onRemove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.value);
      setValue(
        (current) => dropReference(current, "image", index, counts).text
      );
      attachments.removeAt(index);
    },
    [attachments, counts]
  );

  const onRemoveSelection = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.value);
      setValue(
        (current) => dropReference(current, "element", index, counts).text
      );
      selections.removeAt(index);
    },
    [counts, selections]
  );

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    onSubmit(
      value,
      attachments.items,
      selections.items.map((item) => item.element)
    );
    setValue("");
    attachments.clear();
    selections.clear();
  }, [attachments, canSubmit, onSubmit, selections, value]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      const lost = lostReferences(value, next, counts);

      if (!hasLostReferences(lost)) {
        setValue(next);
        return;
      }

      const at = event.target.selectionStart;
      const settled = dropLostReferences(next, lost, counts);

      for (const index of [...lost.image].reverse()) {
        attachments.removeAt(index);
      }
      for (const index of [...lost.element].reverse()) {
        selections.removeAt(index);
      }

      caret.moveTo(Math.min(at, settled.length));
      setValue(settled);
    },
    [attachments, caret, counts, selections, value]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
        return;
      }

      const span = deleting(event, counts);
      if (span === null) {
        return;
      }

      event.preventDefault();
      const dropped = dropReference(
        event.currentTarget.value,
        span.reference,
        span.index,
        counts,
        span.start
      );

      caret.moveTo(dropped.caret);
      setValue(dropped.text);

      if (span.reference === "image") {
        attachments.removeAt(span.index);
        return;
      }
      selections.removeAt(span.index);
    },
    [attachments, caret, counts, selections, submit]
  );

  useForgetSelections(projectId, counts, selections.clear, setValue);

  return useMemo(
    () => ({
      add,
      attachments,
      canSubmit,
      capture,
      caret,
      counts,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      onRemoveSelection,
      select,
      selections,
      submit,
      value,
    }),
    [
      add,
      attachments,
      canSubmit,
      capture,
      caret,
      counts,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      onRemoveSelection,
      select,
      selections,
      submit,
      value,
    ]
  );
}

function useForgetSelections(
  projectId: string | null,
  counts: ReferenceCounts,
  clear: () => void,
  setValue: (step: (current: string) => string) => void
) {
  const opened = useRef(projectId);
  const held = useRef(counts);
  held.current = counts;

  useEffect(() => {
    if (opened.current === projectId) {
      return;
    }

    const was = opened.current;
    opened.current = projectId;
    const { element } = held.current;

    if (was === null || element === 0) {
      return;
    }

    const indexes = Array.from({ length: element }, (_, index) => index);
    setValue((current) =>
      dropReferences(current, "element", indexes, held.current)
    );
    clear();
  }, [clear, projectId, setValue]);
}
