import { execFileSync } from "node:child_process";

export const BASE_PIN = "8ae853e4c08108105684d4b8cac7f22400840d2a";
export const CAPTIONS_PIN = "d6cd742fa4f3ab0a74fecf2ac93f1542fa2ea8f7";
export const CAPTION_NAMES = [
  "caption-active-pop",
  "caption-blur-in",
  "caption-bounce-in",
  "caption-cube",
  "caption-dim-progress",
  "caption-drop",
  "caption-emoji",
  "caption-handwrite",
  "caption-highlight-box",
  "caption-karaoke",
  "caption-knockout",
  "caption-label-maker",
  "caption-marker",
  "caption-outline",
  "caption-prosody",
  "caption-redact",
  "caption-rise",
  "caption-scramble",
  "caption-slice",
  "caption-slot",
  "caption-speaker",
  "caption-split-flap",
  "caption-stack",
  "caption-stamp",
  "caption-subtitle",
  "caption-teleprompter",
  "caption-timeline",
  "caption-typewriter",
  "caption-underline",
  "caption-weight",
  "caption-word-pop",
] as const;

const trees = new Map<string, Set<string>>();

export async function remocnSource(
  pin: string,
  path: string
): Promise<string | null> {
  const checkout = process.env.REMOCN_SOURCE;
  if (checkout) {
    const key = `${checkout}:${pin}`;
    let tree = trees.get(key);
    if (!tree) {
      tree = new Set(
        execFileSync(
          "git",
          ["-C", checkout, "ls-tree", "-r", "--name-only", pin],
          { encoding: "utf8" }
        )
          .trim()
          .split("\n")
      );
      trees.set(key, tree);
    }
    return tree.has(path)
      ? execFileSync("git", ["-C", checkout, "show", `${pin}:${path}`], {
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        })
      : null;
  }
  const response = await fetch(
    `https://raw.githubusercontent.com/Remocn/remocn/${pin}/${path}`
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function requiredSource(
  pin: string,
  path: string
): Promise<string> {
  const source = await remocnSource(pin, path);
  if (source === null) {
    throw new Error(`Missing remocn source: ${pin}/${path}`);
  }
  return source;
}
