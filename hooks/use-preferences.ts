"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { type StudioSettings, saveAssetOffers } from "@/lib/studio/settings";

export interface Preferences {
  assetOffers: boolean;
  setAssetOffers: (enabled: boolean) => void;
}

export function usePreferences(settings: StudioSettings | null): Preferences {
  const [offers, setOffers] = useState<boolean | null>(null);

  const assetOffers = offers ?? settings?.assetOffers ?? true;

  const setAssetOffers = useCallback((enabled: boolean) => {
    setOffers(enabled);
    Effect.runFork(saveAssetOffers(enabled));
  }, []);

  return useMemo(
    () => ({ assetOffers, setAssetOffers }),
    [assetOffers, setAssetOffers]
  );
}
