// The sidebar is a fixed-width column outside the resizable group, so the
// layout only ever holds the chat and the preview.
const WITH_PREVIEW = ["chat", "preview"];
const CHAT_ALONE = ["chat"];

export function showsPreview(
  chosen: boolean | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): boolean {
  return chosen ?? (isLoadingProjects || hasProjects);
}

export function panelIdsOf(isPreviewShown: boolean): string[] {
  return isPreviewShown ? WITH_PREVIEW : CHAT_ALONE;
}
