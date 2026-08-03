const EVERY_PANE = ["projects", "chat", "preview"];
const NO_PREVIEW = ["projects", "chat"];
const NO_PROJECTS = ["chat", "preview"];
const CHAT_ALONE = ["chat"];

export function showsPreview(
  chosen: boolean | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): boolean {
  return chosen ?? (isLoadingProjects || hasProjects);
}

export function panelIdsOf(
  isProjectsShown: boolean,
  isPreviewShown: boolean
): string[] {
  if (isProjectsShown) {
    return isPreviewShown ? EVERY_PANE : NO_PREVIEW;
  }
  return isPreviewShown ? NO_PROJECTS : CHAT_ALONE;
}
