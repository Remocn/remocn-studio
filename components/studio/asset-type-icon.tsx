"use client";

import {
  AudioLinesIcon,
  ComponentIcon,
  type Icon,
  ImageIcon,
  VideoIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/shared/library";

const ICONS: Record<AssetType, Icon> = {
  audio: AudioLinesIcon,
  component: ComponentIcon,
  img: ImageIcon,
  video: VideoIcon,
};

export function AssetTypeIcon({
  className,
  type,
}: {
  className?: string;
  type: AssetType;
}) {
  const Glyph = ICONS[type];

  return <Glyph aria-hidden="true" className={cn("shrink-0", className)} />;
}
