"use client";

import { Effect } from "effect";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { setStockKey, stockStatus } from "@/lib/studio/stock";

export interface StockKey {
  error: string | null;
  isConfigured: boolean | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onForget: () => void;
  onSave: () => void;
  value: string;
}

export function useStockKey(): StockKey {
  const [value, setValue] = useState("");
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Effect.runFork(
      stockStatus.pipe(
        Effect.tap((configured) =>
          Effect.sync(() => setIsConfigured(configured))
        ),
        Effect.ignore
      )
    );
  }, []);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value);
  }, []);

  const store = useCallback((key: string | null) => {
    Effect.runFork(
      setStockKey(key).pipe(
        Effect.tap((configured) =>
          Effect.sync(() => {
            setIsConfigured(configured);
            setValue("");
            setError(null);
          })
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => setError(causeMessage(cause)))
        ),
        Effect.ignore
      )
    );
  }, []);

  const onSave = useCallback(() => {
    const key = value.trim();
    if (key.length > 0) {
      store(key);
    }
  }, [store, value]);

  const onForget = useCallback(() => {
    store(null);
  }, [store]);

  return useMemo(
    () => ({ error, isConfigured, onChange, onForget, onSave, value }),
    [error, isConfigured, onChange, onForget, onSave, value]
  );
}
