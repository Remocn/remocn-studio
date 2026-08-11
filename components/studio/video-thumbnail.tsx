"use client";

import type { SyntheticEvent } from "react";
import { firstFrameAt } from "@/lib/studio/thumbnail";
import { cn } from "@/lib/utils";

function seekToFirstFrame(event: SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget;

  if (video.currentTime === 0) {
    video.currentTime = firstFrameAt(video.duration);
  }
}

export function VideoThumbnail({
  className,
  onError,
  src,
}: {
  className?: string;
  onError?: () => void;
  src: string;
}) {
  return (
    <video
      className={cn("", className)}
      muted
      onError={onError}
      onLoadedMetadata={seekToFirstFrame}
      playsInline
      preload="metadata"
      src={`${src}#t=${firstFrameAt(0)}`}
    >
      <track kind="captions" />
    </video>
  );
}
