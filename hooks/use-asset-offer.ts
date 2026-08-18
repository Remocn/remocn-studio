"use client";

import { Effect } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dismissAttachments, offerableAttachments } from "@/lib/studio/library";
import type { PromptMedia, TranscriptEntry } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

export interface AssetOffer {
  isSaving: boolean;
  items: readonly PromptMedia[];
  onDismiss: () => void;
  onSave: () => void;
  onStrike: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface AssetOfferSettings {
  enabled: boolean;
  entries: readonly TranscriptEntry[];
  isRunning: boolean;
  save: (attachment: PromptMedia) => Promise<Asset | null>;
}

export function useAssetOffer({
  enabled,
  entries,
  isRunning,
  save,
}: AssetOfferSettings): AssetOffer {
  const [items, setItems] = useState<readonly PromptMedia[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const was = useRef(isRunning);
  const held = useRef(entries);
  held.current = entries;

  useEffect(() => {
    const settled = was.current && !isRunning;
    was.current = isRunning;

    if (!(settled && enabled)) {
      return;
    }

    const carried = lastAttachments(held.current);
    if (carried.length === 0) {
      return;
    }

    Effect.runFork(
      offerableAttachments(carried).pipe(
        Effect.tap((offered) =>
          Effect.sync(() => {
            if (offered.length > 0) {
              setItems(offered);
            }
          })
        ),
        Effect.ignore
      )
    );
  }, [enabled, isRunning]);

  const forget = useCallback((dropped: readonly PromptMedia[]) => {
    if (dropped.length > 0) {
      Effect.runFork(Effect.ignore(dismissAttachments(dropped)));
    }
  }, []);

  const onStrike = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.value);

      setItems((current) => {
        const struck = current[index];
        if (struck !== undefined) {
          forget([struck]);
        }
        return current.filter((_, at) => at !== index);
      });
    },
    [forget]
  );

  const onDismiss = useCallback(() => {
    setItems((current) => {
      forget(current);
      return [];
    });
  }, [forget]);

  const onSave = useCallback(() => {
    setIsSaving(true);

    Promise.all(items.map(save))
      .then((saved) => {
        setItems((current) => current.filter((_, at) => saved[at] === null));
      })
      .finally(() => setIsSaving(false));
  }, [items, save]);

  return useMemo(
    () => ({ isSaving, items, onDismiss, onSave, onStrike }),
    [isSaving, items, onDismiss, onSave, onStrike]
  );
}

function lastAttachments(
  entries: readonly TranscriptEntry[]
): readonly PromptMedia[] {
  for (const entry of [...entries].reverse()) {
    if (entry.kind === "user") {
      return [...entry.attachments, ...entry.media];
    }
  }

  return [];
}
