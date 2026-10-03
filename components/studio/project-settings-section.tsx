"use client";
import dynamic from "next/dynamic";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import { useProjectSettings } from "@/hooks/use-project-settings";
import { fileManagerName } from "@/lib/studio/platform";
import { cancelProjectMove, moveProject } from "@/lib/studio/projects";
import { revealInFinder } from "@/lib/studio/shell";
import type { Project } from "@/shared/ipc";
import { ProjectBrandApply } from "./project-brand-apply";
import {
  ProjectSettingsGroup,
  ProjectSettingsRow,
} from "./project-settings-group";
import { useStudio } from "./studio-provider";

const ProjectBrandEditor = dynamic(() =>
  import("./project-brand-editor").then((module) => module.ProjectBrandEditor)
);

export function ProjectSettingsSection() {
  const studio = useStudio();
  const project = studio.projects.find(
    (row) => row.id === studio.settingsView.projectId
  );
  const openProject = useCallback(async () => {
    const opened = await studio.openFolder();
    if (opened) {
      studio.settingsView.openProject(opened.id);
    }
  }, [studio]);
  if (!project) {
    return (
      <div className="grid gap-3">
        <p>
          Open or create a project to configure its name, location and brand.
        </p>
        <div className="flex gap-2">
          <Button onClick={openProject}>Open project…</Button>
          <Button onClick={studio.newProject.open} variant="outline">
            Create project…
          </Button>
        </div>
      </div>
    );
  }
  return <ProjectForm key={project.id} project={project} />;
}
function ProjectForm({ project }: { project: Project }) {
  const studio = useStudio();
  const { draft, setDraft, dirty, saving, save, cancel, error } =
    useProjectSettings(project.id, studio.reloadProjects, project.path);
  const { run, error: actionError } = useAsyncAction();
  const { pick, error: pickerError } = useFolderPicker(
    "Choose the new parent folder"
  );
  const locate = useFolderPicker("Locate the project folder");
  const visibleError = [error, actionError, pickerError, locate.error].find(
    Boolean
  );
  const [importing, setImporting] = useState(false);
  const [parent, setParent] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const { busy, unavailable, locationDisabled, canCancelMove } = formState(
    saving,
    importing,
    phase,
    project.missing,
    dirty
  );
  const { setProjectDirty } = studio.settingsView;
  useEffect(() => {
    setProjectDirty(dirty || busy);
    return () => setProjectDirty(false);
  }, [dirty, busy, setProjectDirty]);
  const move = useCallback(async () => {
    if (!parent || phase) {
      return;
    }
    setPhase("Preparing move…");
    try {
      const next = await run(
        moveProject(project.id, parent, (event) => setPhase(event.phase))
      );
      if (next) {
        studio.replaceProject(next);
        setParent(null);
      } else {
        studio.reloadProjects();
        if (studio.openedProject?.id === project.id) {
          studio.tools.preview.restart();
        }
      }
    } finally {
      setPhase(null);
    }
  }, [parent, phase, project.id, run, studio]);
  const reveal = useCallback(
    () => run(revealInFinder(project.path)),
    [run, project.path]
  );
  const chooseParent = useCallback(async () => setParent(await pick()), [pick]);
  const locateFolder = useCallback(async () => {
    const path = await locate.pick();
    if (path) {
      await studio.relocateProject(project.id, path);
    }
  }, [locate, project.id, studio]);
  const cancelMove = useCallback(() => {
    if (phase) {
      run(cancelProjectMove(project.id));
    } else {
      setParent(null);
    }
  }, [phase, project.id, run]);
  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      save();
    },
    [save]
  );
  const changeName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const name = event.currentTarget.value;
      setDraft((current) => (current ? { ...current, name } : current));
    },
    [setDraft]
  );
  const changeBrand = useCallback(
    (brand: import("@/shared/brand").ProjectBrand | null) => {
      setDraft((current) => (current ? { ...current, brand } : current));
    },
    [setDraft]
  );
  return (
    <div className="grid gap-10 pb-20">
      <form
        className="grid gap-10"
        id="project-settings-form"
        onSubmit={submit}
      >
        <ProjectSettingsGroup title="General">
          {draft ? (
            <ProjectSettingsRow
              description="How this project appears in the studio."
              htmlFor="project-name"
              title="Project name"
            >
              <Input
                className="max-w-full sm:w-60"
                disabled={unavailable}
                id="project-name"
                onChange={changeName}
                required
                value={draft.name}
              />
            </ProjectSettingsRow>
          ) : null}
          <div className="grid gap-3 py-4">
            <div className="grid gap-1">
              <p className="text-sm">Location</p>
              <p className="break-all font-mono text-muted-foreground text-xs leading-relaxed">
                {project.path}
              </p>
            </div>
            {project.missing ? (
              <p className="text-destructive text-sm" role="alert">
                This folder is missing. Locate it to restore the project.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={project.missing || phase !== null}
                onClick={reveal}
                type="button"
                variant="ghost"
              >
                Show in {fileManagerName()}
              </Button>
              <Button
                disabled={locationDisabled}
                onClick={chooseParent}
                type="button"
                variant="ghost"
              >
                Move project
              </Button>
              <Button
                disabled={dirty || busy}
                onClick={locateFolder}
                type="button"
                variant="ghost"
              >
                Locate folder
              </Button>
            </div>
            {parent ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <p className="break-all text-sm">
                  Move to {parent}/{project.path.split("/").at(-1)}
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={phase !== null}
                    onClick={move}
                    type="button"
                  >
                    Move project
                  </Button>
                  <Button
                    disabled={!canCancelMove}
                    onClick={cancelMove}
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            {phase ? (
              <p className="text-sm" role="status">
                {phase}
              </p>
            ) : null}
          </div>
        </ProjectSettingsGroup>
        {draft ? (
          <fieldset className="grid min-w-0 gap-10" disabled={unavailable}>
            <legend className="sr-only">Project brand</legend>
            <ProjectBrandEditor
              onBusyChange={setImporting}
              onChange={changeBrand}
              projectId={project.id}
              root={project.path}
              value={draft.brand}
            />
          </fieldset>
        ) : null}
      </form>
      {draft ? (
        <ProjectSaveBar
          busy={busy}
          canSave={Boolean(dirty && draft.name.trim()) && !unavailable}
          dirty={dirty}
          onCancel={cancel}
          saving={saving}
        />
      ) : null}
      {draft || project.missing || error ? null : (
        <p role="status">Loading project settings…</p>
      )}
      {draft ? (
        <ProjectBrandApply
          disabled={locationDisabled}
          projectId={project.id}
          revision={draft.revision}
        />
      ) : null}
      {visibleError ? (
        <p className="text-destructive text-sm" role="alert">
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}

function formState(
  saving: boolean,
  importing: boolean,
  phase: string | null,
  missing: boolean,
  dirty: boolean
) {
  const busy = saving || importing || phase !== null;
  const unavailable = busy || missing;
  return {
    busy,
    canCancelMove:
      phase === null ||
      phase.startsWith("Copying") ||
      phase.startsWith("Verifying"),
    locationDisabled: dirty || unavailable,
    unavailable,
  };
}

function ProjectSaveBar({
  busy,
  canSave,
  dirty,
  onCancel,
  saving,
}: {
  busy: boolean;
  canSave: boolean;
  dirty: boolean;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 ms-56 border-border/60 border-t bg-background px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-[688px] flex-wrap items-center justify-end gap-3">
        <p className="me-auto text-muted-foreground text-xs" role="status">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <Button
          disabled={!dirty || busy}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Cancel changes
        </Button>
        <Button disabled={!canSave} form="project-settings-form" type="submit">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
