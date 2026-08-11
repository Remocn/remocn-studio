"use client";

import { LibraryBigIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AssetOffer } from "@/hooks/use-asset-offer";
import { MediaRow } from "./media-row";

export function AssetOfferCard({ offer }: { offer: AssetOffer }) {
  if (offer.items.length === 0) {
    return null;
  }

  const count = offer.items.length;

  return (
    <div className="mb-2 shrink-0 px-4 pt-1">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-dashed px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LibraryBigIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <p className="min-w-0 text-sm">
            Keep {count === 1 ? "this file" : `these ${count} files`} in the
            asset library?
          </p>
        </div>

        <MediaRow items={offer.items} onRemove={offer.onStrike} />

        <div className="flex items-center justify-end gap-2">
          <Button
            disabled={offer.isSaving}
            onClick={offer.onDismiss}
            size="sm"
            variant="ghost"
          >
            No thanks
          </Button>
          <Button disabled={offer.isSaving} onClick={offer.onSave} size="sm">
            {offer.isSaving ? <Spinner className="size-3.5" /> : null}
            Save to library
          </Button>
        </div>
      </div>
    </div>
  );
}
