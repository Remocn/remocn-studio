import type { MouseEvent } from "react";
import { FolderIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Project } from "@/shared/ipc";

export function ProjectItem({
  active,
  onSelect,
  project,
}: {
  active: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  project: Project;
}) {
  return (
    <button
      aria-current={active ? "true" : undefined}
      className={cn(ROW, active && "text-foreground")}
      onClick={onSelect}
      title={
        project.missing
          ? `${project.path} is missing — locate it in Project settings`
          : project.path
      }
      type="button"
      value={project.id}
    >
      <FolderIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      {project.missing ? (
        <span className="text-2xs text-muted-foreground">Missing</span>
      ) : null}
    </button>
  );
}

const ROW =
  "flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-muted-foreground text-sm outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-[-2px]";
