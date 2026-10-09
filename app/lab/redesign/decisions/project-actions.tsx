"use client";

import { useCallback, useMemo, useState } from "react";
import { ProjectDialogs } from "@/components/studio/project-dialogs";
import { Button } from "@/components/ui/button";
import { useProjectMenu } from "@/hooks/use-project-menu";
import type { Project } from "@/shared/ipc";

const PROJECT: Project = {
  createdAt: 0,
  id: "fixture-project",
  missing: false,
  name: "Product launch",
  path: "/fixture/projects/product-launch-with-a-long-folder-name-for-dialog-layout",
  updatedAt: 0,
};

export function ProjectActions() {
  const [project, setProject] = useState(PROJECT);
  const [result, setResult] = useState("No project action yet");
  const renameProject = useCallback((_id: string, name: string) => {
    setProject((current) => ({ ...current, name }));
    setResult(`Renamed to ${name}`);
    return Promise.resolve();
  }, []);
  const removeProject = useCallback(() => {
    setResult("Remove requested in memory; no files changed");
    return Promise.resolve(true);
  }, []);
  const relocateProject = useCallback(() => Promise.resolve(), []);
  const commands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );
  const menu = useProjectMenu(project, commands);

  return (
    <section aria-label="Project actions" className="flex flex-col gap-3">
      <h2 className="font-medium text-base">Project dialogs</h2>
      <div className="flex gap-2">
        <Button onClick={menu.openRename} variant="outline">
          Rename project
        </Button>
        <Button onClick={menu.openRemove} variant="outline">
          Remove project
        </Button>
      </div>
      <output
        aria-label="Project action result"
        className="text-muted-foreground text-xs"
      >
        {result}
      </output>
      <ProjectDialogs menu={menu} project={project} />
    </section>
  );
}
