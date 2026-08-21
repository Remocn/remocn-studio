"use client";

import { Effect, Fiber } from "effect";
import type { ChangeEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { causeMessage } from "@/lib/error-message";
import { saveStock, searchStock, stockStatus } from "@/lib/studio/stock";
import type { StockProgress } from "@/shared/ipc";
import type { StockItem, StockKind } from "@/shared/library";

const DEBOUNCE = "350 millis";

// Photo and video ids are separate Pexels sequences, so the raw id cannot key
// a mixed set of results.
export function stockKeyOf(item: StockItem): string {
  return `${item.kind}:${item.id}`;
}

export interface Stock {
  error: string | null;
  hasMore: boolean;
  isConfigured: boolean | null;
  isSearching: boolean;
  items: readonly StockItem[];
  more: () => void;
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: (event: MouseEvent<HTMLButtonElement>) => void;
  progress: ReadonlyMap<string, StockProgress>;
  query: string;
  saved: ReadonlySet<string>;
  saving: ReadonlySet<string>;
}

export function useStock(kind: StockKind, onSaved: () => void): Stock {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<readonly StockItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<ReadonlyMap<string, StockProgress>>(
    new Map()
  );

  const held = useRef(onSaved);
  held.current = onSaved;
  const loadingMore = useRef(false);

  useEffect(() => {
    const fiber = Effect.runFork(
      stockStatus.pipe(
        Effect.tap((configured) =>
          Effect.sync(() => setIsConfigured(configured))
        ),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  useEffect(() => {
    const wanted = query.trim();
    if (wanted.length === 0) {
      setItems([]);
      setNextPage(null);
      setError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Interruption skips the taps and only a fresh run flips isSearching, so
    // typing on never flickers the skeletons off and back.
    const fiber = Effect.runFork(
      Effect.sleep(DEBOUNCE).pipe(
        Effect.andThen(searchStock({ kind, page: 1, query: wanted })),
        Effect.tap((page) =>
          Effect.sync(() => {
            setItems(page.items);
            setNextPage(page.nextPage);
            setError(null);
            setIsSearching(false);
          })
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            setError(causeMessage(cause));
            setIsSearching(false);
          })
        ),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [kind, query]);

  const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  }, []);

  const more = useCallback(() => {
    const wanted = query.trim();
    if (nextPage === null || wanted.length === 0 || loadingMore.current) {
      return;
    }

    loadingMore.current = true;

    Effect.runFork(
      searchStock({ kind, page: nextPage, query: wanted }).pipe(
        Effect.tap((page) =>
          Effect.sync(() => {
            setItems((current) => {
              const seen = new Set(current.map(stockKeyOf));
              return [
                ...current,
                ...page.items.filter((item) => !seen.has(stockKeyOf(item))),
              ];
            });
            setNextPage(page.nextPage);
          })
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => setError(causeMessage(cause)))
        ),
        Effect.ignore,
        Effect.ensuring(
          Effect.sync(() => {
            loadingMore.current = false;
          })
        )
      )
    );
  }, [kind, nextPage, query]);

  const onSave = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.value;
      const item = items.find((row) => stockKeyOf(row) === key);
      if (item === undefined || saving.has(key) || saved.has(key)) {
        return;
      }

      setSaving((current) => new Set(current).add(key));

      Effect.runFork(
        saveStock(item, (report) =>
          setProgress((current) => new Map(current).set(key, report))
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              setSaved((current) => new Set(current).add(key));
              held.current();
            })
          ),
          Effect.tapCause((cause) =>
            Effect.sync(() => {
              toast.add({
                description: causeMessage(cause) ?? item.name,
                title: "The download failed",
              });
            })
          ),
          Effect.ignore,
          Effect.ensuring(
            Effect.sync(() => {
              setSaving((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
              });
              setProgress((current) => {
                const next = new Map(current);
                next.delete(key);
                return next;
              });
            })
          )
        )
      );
    },
    [items, saved, saving]
  );

  return useMemo(
    () => ({
      error,
      hasMore: nextPage !== null,
      isConfigured,
      isSearching,
      items,
      more,
      onQueryChange,
      onSave,
      progress,
      query,
      saved,
      saving,
    }),
    [
      error,
      nextPage,
      isConfigured,
      isSearching,
      items,
      more,
      onQueryChange,
      onSave,
      progress,
      query,
      saved,
      saving,
    ]
  );
}
