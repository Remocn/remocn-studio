"use client";

import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NativeCheckbox } from "@/components/ui/checkbox";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  confirmVideoBrand,
  getVideoBrandStatus,
  listVideos,
} from "@/lib/studio/projects";
import type { ProjectBrandApplication } from "@/shared/brand";
import type { Video } from "@/shared/ipc";
import { useStudio } from "./studio-provider";

interface BrandJob {
  historyId: string;
  revision: number;
  status: ProjectBrandApplication["status"];
  videoId: string;
}

import { ProjectSettingsGroup } from "./project-settings-group";

export function ProjectBrandApply({
  projectId,
  revision,
  disabled,
}: {
  projectId: string;
  revision: number;
  disabled: boolean;
}) {
  const studio = useStudio();
  const { run, error } = useAsyncAction();
  const [videos, setVideos] = useState<readonly Video[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [jobs, setJobs] = useState<readonly BrandJob[]>([]);
  useEffect(() => {
    let live = true;
    async function load() {
      const rows = await run(listVideos(projectId));
      if (!(live && rows)) {
        return;
      }
      const present = rows.filter((row) => row.deletedAt === null);
      setVideos(present);
      const applications = await Promise.all(
        present.map(async (video) => ({
          application: await run(getVideoBrandStatus(video.id)),
          videoId: video.id,
        }))
      );
      if (live) {
        setJobs(
          applications.flatMap(({ videoId, application }) =>
            application?.historyId
              ? [
                  {
                    historyId: application.historyId,
                    revision: application.target.revision,
                    status: application.status,
                    videoId,
                  },
                ]
              : []
          )
        );
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [projectId, run]);
  const apply = useCallback(() => {
    const next: BrandJob[] = selected.map((videoId) => ({
      historyId: crypto.randomUUID(),
      revision,
      status: "running",
      videoId,
    }));
    for (const job of next) {
      studio.setTurnProvider(job.historyId, studio.provider);
      studio.sendTurn({
        ...job,
        assets: [],
        attachments: [],
        brandRevision: revision,
        effort: studio.claudeEffort,
        elements: [],
        media: [],
        mode: "acceptEdits",
        model: studio.models[studio.provider],
        playing: null,
        projectId,
        prompt:
          "Apply the selected project brand revision to this video. Preserve local exceptions and unrelated changes. Verify every scene it affects, and report the result for my review before Studio confirms the new brand snapshot.",
      });
    }
    setJobs((current) => [
      ...current.filter((job) => !selected.includes(job.videoId)),
      ...next,
    ]);
    setSelected([]);
  }, [projectId, revision, selected, studio]);
  const selectAll = useCallback(
    () =>
      setSelected(
        videos
          .filter((video) => !studio.isVideoBusy(video.id))
          .map((video) => video.id)
      ),
    [videos, studio]
  );
  const toggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { checked, value } = event.currentTarget;
    setSelected((current) =>
      checked ? [...current, value] : current.filter((id) => id !== value)
    );
  }, []);
  const showTask = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const session = studio.sessions.find(
        (row) => row.id === event.currentTarget.value
      );
      if (session) {
        studio.selectSession(session);
        studio.settingsView.close();
      }
    },
    [studio]
  );
  const confirm = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const historyId = event.currentTarget.value;
      const job = jobs.find((row) => row.historyId === historyId);
      if (!job) {
        return;
      }
      const result = await run(
        confirmVideoBrand(projectId, job.videoId, job.revision)
      );
      if (result) {
        setJobs((current) =>
          current.map((row) =>
            row.historyId === historyId ? { ...row, status: "confirmed" } : row
          )
        );
      }
    },
    [jobs, projectId, run]
  );
  return (
    <ProjectSettingsGroup title="Existing videos">
      <details className="group">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 py-1 text-sm outline-offset-4 [&::-webkit-details-marker]:hidden">
          <span>Apply brand to existing videos</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
          />
        </summary>
        <div className="grid gap-3 py-3">
          <p className="text-muted-foreground text-sm">
            The agent updates the selected videos. Review the changes and
            preview before confirming their new brand.
          </p>
          <Button
            className="justify-self-start"
            disabled={disabled}
            onClick={selectAll}
            size="sm"
            variant="ghost"
          >
            Select all videos
          </Button>
          {videos.map((video) => (
            <label
              className="flex min-h-8 items-center gap-2 text-sm"
              htmlFor={`apply-brand-${video.id}`}
              key={video.id}
            >
              <NativeCheckbox
                checked={selected.includes(video.id)}
                disabled={disabled || studio.isVideoBusy(video.id)}
                id={`apply-brand-${video.id}`}
                onChange={toggle}
                value={video.id}
              />
              {video.name}
            </label>
          ))}
          <Button
            className="justify-self-start"
            disabled={disabled || selected.length === 0}
            onClick={apply}
            size="sm"
            variant="outline"
          >
            Apply to selected videos
          </Button>
        </div>
      </details>
      {jobs.map((job) => {
        const turn = studio.statuses.get(job.historyId);
        let { status } = job;
        if (turn === "running" || turn === "waiting") {
          status = "running";
        } else if (turn === "failed") {
          status = "failed";
        } else if (turn !== undefined && status === "running") {
          status = "awaiting-review";
        }
        const message = {
          "awaiting-review": "Review the changes before confirming",
          confirmed: "Brand confirmed",
          failed: "Update failed; previous brand retained",
          running: "Updating appearance…",
        }[status];
        return (
          <div className="grid gap-3 py-4" key={job.historyId}>
            <p className="text-sm">
              {videos.find((video) => video.id === job.videoId)?.name}:{" "}
              {message}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={showTask}
                value={job.historyId}
                variant="outline"
              >
                Open agent task
              </Button>
              {status === "awaiting-review" ? (
                <Button
                  onClick={confirm}
                  value={job.historyId}
                  variant="outline"
                >
                  I reviewed the result — confirm brand
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </ProjectSettingsGroup>
  );
}
