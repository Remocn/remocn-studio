"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useMemo, useState } from "react";

export interface Composer {
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: () => void;
  value: string;
}

export function useComposer(onSubmit: (text: string) => void): Composer {
  const [value, setValue] = useState("");

  const submit = useCallback(() => {
    if (value.trim().length === 0) {
      return;
    }
    onSubmit(value);
    setValue("");
  }, [onSubmit, value]);

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
    () => ({ onChange, onKeyDown, submit, value }),
    [onChange, onKeyDown, submit, value]
  );
}
