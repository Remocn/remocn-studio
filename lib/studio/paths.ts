const SEPARATOR = /[/\\]+/;

export function folderName(path: string): string {
  const segments = path.split(SEPARATOR).filter(Boolean);
  return segments.at(-1) ?? path;
}
