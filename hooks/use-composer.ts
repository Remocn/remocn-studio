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
import { type Media, useMedia } from "@/hooks/use-media";
import { type PickedAssets, usePickedAssets } from "@/hooks/use-picked-assets";
import { type Selections, useSelections } from "@/hooks/use-selections";
import { imageFilesOf } from "@/lib/studio/clipboard";
import type { PreviewRect } from "@/lib/studio/preview";
import type {
  PromptAttachment,
  PromptElement,
  PromptMedia,
} from "@/shared/ipc";
import type { Asset, PromptAsset } from "@/shared/library";
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
  onEscape?: () => void;
  onSubmit: (
    text: string,
    attachments: readonly PromptAttachment[],
    elements: readonly PromptElement[],
    assets: readonly PromptAsset[],
    media: readonly PromptMedia[]
  ) => void;
  projectId: string | null;
}

export interface Composer {
  add: () => Promise<void>;
  addMedia: () => Promise<void>;
  assets: PickedAssets;
  attachments: Attachments;
  canSubmit: boolean;
  capture: (file: File) => Promise<void>;
  caret: Caret;
  counts: ReferenceCounts;
  media: Media;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveAsset: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveMedia: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSelection: (event: MouseEvent<HTMLButtonElement>) => void;
  pick: (asset: Asset) => void;
  select: (
    element: PromptElement,
    rect: PreviewRect,
    comment: string
  ) => string;
  selections: Selections;
  submit: () => void;
  value: string;
  write: (phrase: string) => void;
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
  onEscape,
  onSubmit,
  projectId,
}: ComposerSettings): Composer {
  const [value, setValue] = useState("");

  // The live text, read by everything that inserts at the caret. Closing over
  // `value` instead would remint those callbacks on every keystroke, and they
  // are handed to memoised rows that would then re-render as you type.
  const latest = useRef(value);
  latest.current = value;

  const attachments = useAttachments();
  const selections = useSelections();
  const assets = usePickedAssets();
  const media = useMedia();
  const caret = useCaret();

  const counts = useMemo(
    () => ({
      asset: assets.items.length,
      element: selections.items.length,
      image: attachments.items.length,
    }),
    [assets.items.length, attachments.items.length, selections.items.length]
  );

  const canSubmit =
    value.trim().length > 0 ||
    counts.image > 0 ||
    counts.element > 0 ||
    counts.asset > 0 ||
    media.items.length > 0;

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
      const text = field?.value ?? latest.current;
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
    [caret, selections]
  );

  const pick = useCallback(
    (asset: Asset) => {
      const field = caret.ref.current;
      const text = field?.value ?? latest.current;
      const at = field?.selectionStart ?? text.length;
      const index = assets.add(asset);

      const next = insertReferences(text, at, "asset", index, 1);
      caret.moveTo(next.caret);
      setValue(next.text);
    },
    [assets, caret]
  );

  const write = useCallback(
    (phrase: string) => {
      const field = caret.ref.current;
      const text = field?.value ?? latest.current;
      const at = field?.selectionStart ?? text.length;

      const next = insertAt(text, at, phrase.trim());
      caret.moveTo(next.caret);
      setValue(next.text);
    },
    [caret]
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

  const onRemoveAsset = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.value);
      setValue(
        (current) => dropReference(current, "asset", index, counts).text
      );
      assets.removeAt(index);
    },
    [assets, counts]
  );

  const addMedia = useCallback(async () => {
    await media.add();
  }, [media]);

  const onRemoveMedia = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      media.removeAt(Number(event.currentTarget.value));
    },
    [media]
  );

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    onSubmit(
      value,
      attachments.items,
      selections.items.map((item) => item.element),
      assets.items,
      media.items
    );
    setValue("");
    attachments.clear();
    selections.clear();
    assets.clear();
    media.clear();
  }, [assets, attachments, canSubmit, media, onSubmit, selections, value]);

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
      for (const index of [...lost.asset].reverse()) {
        assets.removeAt(index);
      }

      caret.moveTo(Math.min(at, settled.length));
      setValue(settled);
    },
    [assets, attachments, caret, counts, selections, value]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === "Escape" && onEscape !== undefined) {
        event.preventDefault();
        onEscape();
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
      if (span.reference === "asset") {
        assets.removeAt(span.index);
        return;
      }
      selections.removeAt(span.index);
    },
    [assets, attachments, caret, counts, onEscape, selections, submit]
  );

  useForgetSelections(projectId, counts, selections.clear, setValue);

  return useMemo(
    () => ({
      add,
      addMedia,
      assets,
      attachments,
      canSubmit,
      capture,
      caret,
      counts,
      media,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      onRemoveAsset,
      onRemoveMedia,
      onRemoveSelection,
      pick,
      select,
      selections,
      submit,
      value,
      write,
    }),
    [
      add,
      addMedia,
      assets,
      attachments,
      canSubmit,
      capture,
      caret,
      counts,
      media,
      onChange,
      onKeyDown,
      onPaste,
      onRemove,
      onRemoveAsset,
      onRemoveMedia,
      onRemoveSelection,
      pick,
      select,
      selections,
      submit,
      value,
      write,
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
