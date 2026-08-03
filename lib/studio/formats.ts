import type { VideoSize } from "@/shared/ipc";

export interface VideoFormat {
  height: number;
  id: string;
  label: string;
  note: string;
  title: string;
  width: number;
}

const LANDSCAPE: VideoFormat = {
  height: 1080,
  id: "landscape",
  label: "16:9",
  note: "YouTube",
  title: "Landscape",
  width: 1920,
};

const VERTICAL: VideoFormat = {
  height: 1920,
  id: "vertical",
  label: "9:16",
  note: "Shorts, TikTok, Reels",
  title: "Vertical",
  width: 1080,
};

const SQUARE: VideoFormat = {
  height: 1080,
  id: "square",
  label: "1:1",
  note: "Instagram feed",
  title: "Square",
  width: 1080,
};

const PORTRAIT: VideoFormat = {
  height: 1350,
  id: "portrait",
  label: "4:5",
  note: "Instagram portrait",
  title: "Portrait",
  width: 1080,
};

export const VIDEO_FORMATS: readonly VideoFormat[] = [
  LANDSCAPE,
  VERTICAL,
  SQUARE,
  PORTRAIT,
];

export const DEFAULT_FORMAT = LANDSCAPE;

export function formatById(id: string): VideoFormat {
  return VIDEO_FORMATS.find((format) => format.id === id) ?? DEFAULT_FORMAT;
}

export function sizeOf({ height, width }: VideoFormat): VideoSize {
  return { height, width };
}
