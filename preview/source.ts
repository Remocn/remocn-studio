const WEBPACK_PREFIX = /^webpack:\/\/[^/]*\//;
const SCHEME_PREFIX = /^[a-z]+:\/\//;
const LEADING_DOT = /^\.\//;
const PROXY_FRAMES = new Set(["apply", "Proxy.apply", "Reflect.apply"]);
const MODULES = "/node_modules/";

export interface StackFrame {
  columnNumber?: number;
  fileName?: string;
  functionName?: string;
  lineNumber?: number;
}

export interface SourceSpot {
  column: number | null;
  file: string;
  line: number | null;
  name: string | null;
}

export function joinPath(root: string, relative: string): string {
  const segments = root.split("/").filter(Boolean);

  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return `/${segments.join("/")}`;
}

export function absolutise(
  root: string,
  file: string | null | undefined
): string | null {
  if (typeof file !== "string" || file.length === 0) {
    return null;
  }

  const stripped = file.replace(WEBPACK_PREFIX, "").replace(LEADING_DOT, "");

  if (SCHEME_PREFIX.test(stripped)) {
    return null;
  }

  return stripped.startsWith("/")
    ? joinPath("/", stripped)
    : joinPath(root, stripped);
}

export function isProjectFile(root: string, file: string): boolean {
  return file.startsWith(`${root}/`) && !file.includes(MODULES);
}

export function projectFrames(
  root: string,
  frames: readonly StackFrame[] | null
): SourceSpot[] {
  if (frames === null) {
    return [];
  }

  const spots: SourceSpot[] = [];

  for (const frame of frames) {
    const file = absolutise(root, frame.fileName);
    const name = frame.functionName ?? null;

    if (file === null || !isProjectFile(root, file)) {
      continue;
    }
    if (name !== null && PROXY_FRAMES.has(name)) {
      continue;
    }

    spots.push({
      column: numberOr(frame.columnNumber),
      file,
      line: numberOr(frame.lineNumber),
      name,
    });
  }

  return spots;
}

export function formatFrame(spot: SourceSpot): string {
  const at = [spot.file, spot.line, spot.column]
    .filter((part) => part !== null)
    .join(":");

  return spot.name === null ? at : `${spot.name} (${at})`;
}

export function truncateMarkup(html: string, limit: number): string {
  return html.length <= limit ? html : `${html.slice(0, limit)}…`;
}

function numberOr(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}
