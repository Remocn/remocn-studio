"use client";

import { useCallback, useMemo, useState } from "react";
import { previewUrl } from "@/lib/studio/attachments";

export interface PreviewImage {
  onError: () => void;
  src: string | null;
}

export function usePreviewImage(path: string): PreviewImage {
  const [broken, setBroken] = useState(false);
  const onError = useCallback(() => setBroken(true), []);
  const src = useMemo(() => (broken ? null : previewUrl(path)), [broken, path]);

  return { onError, src };
}
