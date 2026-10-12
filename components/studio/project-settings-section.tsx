"use client";
import dynamic from "next/dynamic";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { FolderOpenIcon, PencilIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
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
  const [tab, setTab] = useState("general");
  const changeTab = useCallback((value: unknown) => {
    if (typeof value === "string") {
      setTab(value);
    }
  }, []);
  const editBrand = useCallback(() => setTab("brand"), []);
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
    <Tabs
      className="@container flex min-h-0 flex-1 flex-col gap-4"
      onValueChange={changeTab}
      value={tab}
    >
      <TabsList
        aria-label="Project settings"
        className="-m-0.5 mb-[7px]"
        variant="quiet"
      >
        <TabsTab value="general">General</TabsTab>
        <TabsTab value="brand">Brand</TabsTab>
        <TabsTab value="typography">Typography</TabsTab>
        <TabsTab value="guidelines">Guidelines</TabsTab>
      </TabsList>
      <form className="contents" id="project-settings-form" onSubmit={submit}>
        <TabsPanel className="flex-1" keepMounted value="general">
          <ProjectSettingsGroup title="General">
            {draft ? (
              <ProjectSettingsRow
                description="How this project appears in the studio."
                htmlFor="project-name"
                title="Project name"
              >
                <Input
                  className="w-full"
                  disabled={unavailable}
                  id="project-name"
                  onChange={changeName}
                  required
                  size="sm"
                  value={draft.name}
                />
              </ProjectSettingsRow>
            ) : null}
            <div className="grid gap-4 py-3">
              <div className="grid gap-2">
                <p className="text-[14px] leading-5">Location</p>
                <p className="break-all font-mono text-muted-foreground text-sm leading-[18px]">
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
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <FolderOpenIcon />
                  Show in {fileManagerName()}
                </Button>
                <Button
                  disabled={locationDisabled}
                  onClick={chooseParent}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Move project
                </Button>
                <Button
                  disabled={dirty || busy}
                  onClick={locateFolder}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Locate folder
                </Button>
              </div>
              {parent ? (
                <div className="grid gap-2 rounded-lg bg-field p-3">
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-[15px]">
            <div className="grid gap-1.5">
              <h3 className="font-medium text-[14px] leading-5">
                Brand for this project
              </h3>
              <p className="text-muted-foreground text-sm leading-[18px]">
                Colors, typography and guidelines apply to new videos.
              </p>
            </div>
            <Button
              onClick={editBrand}
              size="sm"
              type="button"
              variant="secondary"
            >
              <PencilIcon />
              Edit brand
            </Button>
          </div>
        </TabsPanel>
        {draft ? (
          <fieldset className="contents" disabled={unavailable}>
            <legend className="sr-only">Project brand</legend>
            <ProjectBrandEditor
              brandActions={
                <ProjectBrandApply
                  disabled={locationDisabled}
                  projectId={project.id}
                  revision={draft.revision}
                />
              }
              onBusyChange={setImporting}
              onChange={changeBrand}
              projectId={project.id}
              root={project.path}
              value={draft.brand}
            />
          </fieldset>
        ) : null}
      </form>
      {draft || project.missing || error ? null : (
        <p role="status">Loading project settings…</p>
      )}
      {visibleError ? (
        <p className="text-destructive text-sm" role="alert">
          {visibleError}
        </p>
      ) : null}
      {draft ? (
        <ProjectSaveBar
          busy={busy}
          canSave={Boolean(dirty && draft.name.trim()) && !unavailable}
          dirty={dirty}
          onCancel={cancel}
          saving={saving}
        />
      ) : null}
    </Tabs>
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
    <div className="sticky -bottom-2 mt-auto bg-background">
      <div className="flex min-h-14 flex-wrap items-center justify-end gap-2 py-2">
        <p className="me-auto text-muted-foreground text-sm" role="status">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <Button
          disabled={!dirty || busy}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="secondary"
        >
          Cancel changes
        </Button>
        <Button
          disabled={!canSave}
          form="project-settings-form"
          size="sm"
          type="submit"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
