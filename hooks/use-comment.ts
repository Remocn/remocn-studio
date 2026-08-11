"use client";

import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAVE_ELEMENT_PROMPT } from "@/lib/studio/library";

export interface Comment {
  keep: () => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  ref: RefObject<HTMLTextAreaElement | null>;
  submit: () => void;
  value: string;
}

export function useComment(
  onSubmit: (comment: string) => void,
  onCancel: () => void
): Comment {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // The card is not a popover, so returning focus on close is ours to do.
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();

    return () => {
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, []);

  const onChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  }, []);

  const submit = useCallback(() => {
    onSubmit(value);
  }, [onSubmit, value]);

  const keep = useCallback(() => {
    const written = value.trim();
    onSubmit(
      written.length === 0
        ? SAVE_ELEMENT_PROMPT
        : `${written} ${SAVE_ELEMENT_PROMPT}`
    );
  }, [onSubmit, value]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [onCancel, submit]
  );

  return useMemo(
    () => ({ keep, onChange, onKeyDown, ref, submit, value }),
    [keep, onChange, onKeyDown, submit, value]
  );
}
