"use client";

import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Comment {
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
    () => ({ onChange, onKeyDown, ref, submit, value }),
    [onChange, onKeyDown, submit, value]
  );
}
