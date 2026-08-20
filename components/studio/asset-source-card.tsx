"use client";

import { Effect } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { pickSourceAsset } from "@/lib/studio/shell";
import type { PendingSourceAsset } from "@/lib/studio/turns";
import type { SourceAssetAction } from "@/shared/ipc";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function AssetSourceCard({
  onAnswer,
  source,
}: {
  onAnswer: (
    id: string,
    action: SourceAssetAction,
    file: string | null
  ) => Promise<boolean>;
  source: PendingSourceAsset;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => first.current?.focus(), []);

  const answer = useCallback(
    async (action: SourceAssetAction, file: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const matched = await onAnswer(source.id, action, file);
        if (!matched) {
          setError("This request is no longer waiting for an answer.");
          setBusy(false);
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
        setBusy(false);
      }
    },
    [onAnswer, source.id]
  );

  const upload = useCallback(async () => {
    try {
      const file = await Effect.runPromise(pickSourceAsset());
      if (file !== null) {
        await answer("uploaded", file);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [answer]);

  const screenshot = useCallback(() => answer("screenshot", null), [answer]);
  const cancel = useCallback(() => answer("cancel", null), [answer]);
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        cancel();
      }
    },
    [busy, cancel]
  );

  return (
    <Card
      aria-label="Choose the source for this brand asset"
      className="bg-input/50 ring-none"
      data-slot="asset-source-card"
      onKeyDown={onKeyDown}
      size="sm"
    >
      <CardHeader>
        <CardTitle>Original asset needed</CardTitle>
        <p className="text-muted-foreground text-xs">
          The agent could not recover <strong>{source.name}</strong> from the
          supplied source.
        </p>
        <p className="wrap-break-word rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-foreground text-xs">
          {source.source}
        </p>
        <p className="text-muted-foreground text-xs">{source.attempt}</p>
        {error === null ? null : (
          <p className="text-destructive text-xs">{error}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          <button
            className="-mx-1 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={busy}
            onClick={upload}
            ref={first}
            type="button"
          >
            <span className="font-medium text-sm">Upload original</span>
            <span className="ml-2 text-muted-foreground text-xs">
              Choose the authoritative image file
            </span>
          </button>
          <button
            className="-mx-1 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={busy}
            onClick={screenshot}
            type="button"
          >
            <span className="text-sm">Use site screenshot</span>
            <span className="ml-2 text-muted-foreground text-xs">
              Capture the supplied page without redrawing it
            </span>
          </button>
          <button
            className="-mx-1 rounded-lg px-2 py-1.5 text-left text-destructive text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={busy}
            onClick={cancel}
            type="button"
          >
            Cancel request
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
