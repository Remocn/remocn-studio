"use client";

import {
  AudioLinesIcon,
  ComponentIcon,
  ImageIcon,
  type LucideIcon,
  VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/shared/library";

const ICONS: Record<AssetType, LucideIcon> = {
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
  const Icon = ICONS[type];

  return <Icon aria-hidden="true" className={cn("shrink-0", className)} />;
}
