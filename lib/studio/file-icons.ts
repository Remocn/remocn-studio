import { baseName } from "@/lib/studio/paths";

export const FILE_ICON_KINDS = [
  "archive",
  "audio",
  "css",
  "docker",
  "file",
  "font",
  "git",
  "html",
  "image",
  "javascript",
  "json",
  "markdown",
  "python",
  "react",
  "rust",
  "sass",
  "shell",
  "svg",
  "text",
  "toml",
  "typescript",
  "video",
  "yaml",
] as const;

export type FileIconKind = (typeof FILE_ICON_KINDS)[number];

const BY_NAME = new Map<string, FileIconKind>([
  [".gitattributes", "git"],
  [".gitignore", "git"],
  [".gitmodules", "git"],
  ["bun.lock", "shell"],
  ["dockerfile", "docker"],
]);

const BY_EXTENSION = new Map<string, FileIconKind>([
  ["7z", "archive"],
  ["aac", "audio"],
  ["avi", "video"],
  ["avif", "image"],
  ["bash", "shell"],
  ["bmp", "image"],
  ["cjs", "javascript"],
  ["css", "css"],
  ["cts", "typescript"],
  ["flac", "audio"],
  ["gif", "image"],
  ["gz", "archive"],
  ["htm", "html"],
  ["html", "html"],
  ["ico", "image"],
  ["jpeg", "image"],
  ["jpg", "image"],
  ["js", "javascript"],
  ["json", "json"],
  ["jsonc", "json"],
  ["jsx", "react"],
  ["log", "text"],
  ["m4a", "audio"],
  ["m4v", "video"],
  ["md", "markdown"],
  ["mdx", "markdown"],
  ["mjs", "javascript"],
  ["mkv", "video"],
  ["mov", "video"],
  ["mp3", "audio"],
  ["mp4", "video"],
  ["mts", "typescript"],
  ["ogg", "audio"],
  ["otf", "font"],
  ["png", "image"],
  ["py", "python"],
  ["rar", "archive"],
  ["rs", "rust"],
  ["sass", "sass"],
  ["scss", "sass"],
  ["sh", "shell"],
  ["svg", "svg"],
  ["tar", "archive"],
  ["tgz", "archive"],
  ["toml", "toml"],
  ["ts", "typescript"],
  ["tsx", "react"],
  ["ttf", "font"],
  ["txt", "text"],
  ["wav", "audio"],
  ["webm", "video"],
  ["webp", "image"],
  ["woff", "font"],
  ["woff2", "font"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["zip", "archive"],
  ["zsh", "shell"],
]);

export function fileIconKind(path: string): FileIconKind {
  const name = baseName(path).toLowerCase();

  const named = BY_NAME.get(name);
  if (named !== undefined) {
    return named;
  }

  const cut = name.lastIndexOf(".");
  if (cut <= 0) {
    return "file";
  }

  return BY_EXTENSION.get(name.slice(cut + 1)) ?? "file";
}
