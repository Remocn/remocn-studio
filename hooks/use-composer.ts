"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { type Attachments, useAttachments } from "@/hooks/use-attachments";
import type { PromptAttachment } from "@/shared/ipc";

export interface Composer {
  attachments: Attachments;
  canSubmit: boolean;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: () => void;
  value: string;
}

export function useComposer(
  onSubmit: (text: string, attachments: readonly PromptAttachment[]) => void
): Composer {
  const [value, setValue] = useState("");
  const attachments = useAttachments();
  const canSubmit = value.trim().length > 0 || attachments.items.length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    onSubmit(value, attachments.items);
    setValue("");
    attachments.clear();
  }, [attachments, canSubmit, onSubmit, value]);

  const onChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return useMemo(
    () => ({ attachments, canSubmit, onChange, onKeyDown, submit, value }),
    [attachments, canSubmit, onChange, onKeyDown, submit, value]
  );
}
