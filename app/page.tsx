import { AppShell } from "@/components/studio/app-shell";
import { ContextMenuGuard } from "@/components/studio/context-menu-guard";
import { WindowControls } from "@/components/studio/window-controls";

export default function Page() {
  return (
    <>
      <ContextMenuGuard />
      <AppShell />
      <WindowControls />
    </>
  );
}
