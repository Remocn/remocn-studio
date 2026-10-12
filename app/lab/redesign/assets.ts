import type { Asset } from "@/shared/library";

const ITEMS: readonly (readonly [string, Asset["type"]])[] = [
  ["Product still", "img"],
  ["Brand reference", "img"],
  ["Theme music", "audio"],
  ["Opening scene", "video"],
  ["Portrait reference for the autumn product launch", "img"],
  ["Closing sound", "audio"],
  ["Soft title reveal", "component"],
  ["Product feature card", "component"],
  ["Lower third", "component"],
  ["Number counter", "component"],
];

export const LIBRARY_ASSETS: Asset[] = ITEMS.map(([name, type], index) => ({
  audiomap: null,
  category: null,
  clip: null,
  createdAt: 1_700_000_000_000,
  dependencies: [],
  description: "Visual QA fixture",
  duration: type === "audio" || type === "video" ? 12 : null,
  files: [],
  name,
  path: `/fixture/library/${index}`,
  preview: null,
  proxied: false,
  role: null,
  slug: `fixture-${index}`,
  source: null,
  type,
}));
