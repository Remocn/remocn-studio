"use client";

import { Effect } from "effect";
import { useEffect, useState } from "react";
import { hydrateSettings, type StudioSettings } from "@/lib/studio/settings";

export function useHydratedSettings(): StudioSettings | null {
  const [settings, setSettings] = useState<StudioSettings | null>(null);

  useEffect(() => {
    let active = true;

    Effect.runPromise(hydrateSettings).then((loaded) => {
      if (active) {
        setSettings(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return settings;
}
