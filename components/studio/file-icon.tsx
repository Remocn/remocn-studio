"use client";

import SiCss from "@icons-pack/react-simple-icons/icons/SiCss";
import SiDocker from "@icons-pack/react-simple-icons/icons/SiDocker";
import SiGit from "@icons-pack/react-simple-icons/icons/SiGit";
import SiGnubash from "@icons-pack/react-simple-icons/icons/SiGnubash";
import SiHtml5 from "@icons-pack/react-simple-icons/icons/SiHtml5";
import SiJavascript from "@icons-pack/react-simple-icons/icons/SiJavascript";
import SiJson from "@icons-pack/react-simple-icons/icons/SiJson";
import SiMarkdown from "@icons-pack/react-simple-icons/icons/SiMarkdown";
import SiPython from "@icons-pack/react-simple-icons/icons/SiPython";
import SiReact from "@icons-pack/react-simple-icons/icons/SiReact";
import SiRust from "@icons-pack/react-simple-icons/icons/SiRust";
import SiSass from "@icons-pack/react-simple-icons/icons/SiSass";
import SiSvg from "@icons-pack/react-simple-icons/icons/SiSvg";
import SiToml from "@icons-pack/react-simple-icons/icons/SiToml";
import SiTypescript from "@icons-pack/react-simple-icons/icons/SiTypescript";
import SiYaml from "@icons-pack/react-simple-icons/icons/SiYaml";
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon as FileBlankIcon,
  FileImageIcon,
  FileTextIcon,
  FileTypeIcon,
  FileVideoIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { type FileIconKind, fileIconKind } from "@/lib/studio/file-icons";
import { cn } from "@/lib/utils";

type Glyph = ComponentType<{ "aria-hidden"?: boolean; className?: string }>;

const BRANDED = new Set<FileIconKind>([
  "css",
  "docker",
  "git",
  "html",
  "javascript",
  "json",
  "markdown",
  "python",
  "react",
  "rust",
  "sass",
  "shell",
  "svg",
  "toml",
  "typescript",
  "yaml",
]);

const GLYPHS = new Map<FileIconKind, Glyph>([
  ["archive", FileArchiveIcon],
  ["audio", FileAudioIcon],
  ["css", SiCss],
  ["docker", SiDocker],
  ["font", FileTypeIcon],
  ["git", SiGit],
  ["html", SiHtml5],
  ["image", FileImageIcon],
  ["javascript", SiJavascript],
  ["json", SiJson],
  ["markdown", SiMarkdown],
  ["python", SiPython],
  ["react", SiReact],
  ["rust", SiRust],
  ["sass", SiSass],
  ["shell", SiGnubash],
  ["svg", SiSvg],
  ["text", FileTextIcon],
  ["toml", SiToml],
  ["typescript", SiTypescript],
  ["video", FileVideoIcon],
  ["yaml", SiYaml],
]);

export function FileIcon({
  className,
  path,
}: {
  className?: string;
  path: string;
}) {
  const kind = fileIconKind(path);
  const Glyph = GLYPHS.get(kind) ?? FileBlankIcon;

  return (
    <Glyph
      aria-hidden={true}
      className={cn(className, BRANDED.has(kind) && "scale-90")}
    />
  );
}
