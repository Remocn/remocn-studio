"use client";

import { useTheme } from "next-themes";
import { type MouseEvent, useCallback, useState } from "react";
import { DocsView } from "@/components/studio/docs-view";
import { MarkdownProvider } from "@/components/studio/markdown";
import { PermissionCard } from "@/components/studio/permission-card";
import { WriteFailureCard } from "@/components/studio/write-failure-card";
import { Button } from "@/components/ui/button";
import type { Docs } from "@/hooks/use-docs";
import { documentTabs } from "@/lib/studio/documents";
import type { PermissionAction } from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import type { SessionMode } from "@/shared/ipc";
import { ProjectActions } from "./project-actions";

const FOLDER = "/fixture/src/videos/launch/docs";
const FILES = [
  "analysis.md",
  "brand.md",
  "script.md",
  "motion.md",
  "choreography.md",
  "implementation-notes-for-the-opening-scene.md",
].map((name) => ({ modifiedAt: 1, name, path: `${FOLDER}/${name}` }));
const TABS = documentTabs(FILES);
const COMMAND: PendingPermission = {
  askedAt: 0,
  id: "command",
  input: { command: "bun add remotion" },
  name: "Bash",
  reason: "bash",
};
const PLAN: PendingPermission = {
  askedAt: 0,
  id: "plan",
  input: {
    plan: "## Opening scene\n\n1. Introduce the product.\n2. Hold the title for two seconds.\n3. Transition to the demo.",
  },
  name: "ExitPlanMode",
  reason: "plan",
};
const BATCH: PendingPermission[] = [
  "Door closes",
  "Light rain",
  "Bell rings",
].map((name, index) => ({
  askedAt: 0,
  id: `sound-${index}`,
  input: {
    description: `ElevenLabs · Studio\n${name}\nThis request spends credits on your ElevenLabs account.`,
  },
  name: "Generate sound effect",
  reason: "outward",
}));
const SCENARIOS = ["Command", "Plan", "Batch", "Write failure"];
const PERMISSIONS: Record<string, PendingPermission> = {
  Batch: BATCH[0],
  Command: COMMAND,
  Plan: PLAN,
};
const DOC_STATES = ["Ready", "Loading", "Error", "Empty"];

export default function DecisionsFixture() {
  const { setTheme } = useTheme();
  const [scenario, setScenario] = useState("Command");
  const [docState, setDocState] = useState("Ready");
  const [path, setPath] = useState(FILES[0].path);
  const [answers, setAnswers] = useState<string[]>([]);
  const chooseScenario = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setScenario(event.currentTarget.value);
    setAnswers([]);
  }, []);
  const chooseDocState = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setDocState(event.currentTarget.value),
    []
  );
  const light = useCallback(() => setTheme("light"), [setTheme]);
  const dark = useCallback(() => setTheme("dark"), [setTheme]);
  const answer = useCallback(
    (id: string, action: PermissionAction, mode: SessionMode | null) => {
      setAnswers((current) => [
        ...current,
        `${id}: ${action}${mode === null ? "" : ` (${mode})`}`,
      ]);
    },
    []
  );
  const answerWrite = useCallback(
    (accept: boolean) =>
      setAnswers([accept ? "Send anyway" : "Cancelled without writing"]),
    []
  );
  const pickTab = useCallback((value: unknown) => {
    if (typeof value === "string") {
      setPath(value);
    }
  }, []);
  const reveal = useCallback(() => setAnswers(["Reveal document"]), []);
  const file = FILES.find((item) => item.path === path) ?? FILES[0];
  const docs: Docs = {
    error:
      docState === "Error"
        ? "The document could not be read. Try opening it again."
        : null,
    folder: FOLDER,
    isLoading: docState === "Loading",
    mode: "docs",
    onPickMode: reveal,
    onPickTab: pickTab,
    onReveal: reveal,
    open:
      docState === "Ready"
        ? {
            file,
            text: `# ${file.name}\n\nThe opening introduces one message at a time.\n\n## Scene 1\n\nKeep the title in the safe area and hold it long enough to read.\n\n| Element | Timing |\n| --- | --- |\n| Title | 0–2 s |\n| Supporting copy | 2–5 s |`,
          }
        : null,
    openPath: path,
    pickMode: reveal,
    tabs: docState === "Empty" ? [] : TABS,
  };

  return (
    <MarkdownProvider>
      <main className="h-dvh overflow-auto bg-background p-6 text-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <header className="flex flex-wrap items-center gap-2">
            <h1 className="mr-auto font-semibold text-xl">
              Decisions and documents
            </h1>
            <Button onClick={light} variant="outline">
              Light
            </Button>
            <Button onClick={dark} variant="outline">
              Dark
            </Button>
          </header>
          <ProjectActions />
          <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,387px)_minmax(0,1fr)]">
            <section
              aria-label="Decision card"
              className="flex min-w-0 flex-col gap-4"
            >
              <div className="flex flex-wrap gap-1">
                {SCENARIOS.map((item) => (
                  <Button
                    aria-pressed={scenario === item}
                    key={item}
                    onClick={chooseScenario}
                    size="sm"
                    value={item}
                    variant={scenario === item ? "secondary" : "ghost"}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              {scenario === "Write failure" ? (
                <WriteFailureCard
                  agent="Claude"
                  failure={{
                    kept: 2,
                    refused: [
                      {
                        label: "Title font size",
                        reason: "The value is computed by an expression.",
                      },
                    ],
                  }}
                  onAnswer={answerWrite}
                />
              ) : (
                <PermissionCard
                  asks={scenario === "Batch" ? BATCH : undefined}
                  cwd="/fixture"
                  key={scenario}
                  onAnswer={answer}
                  permission={PERMISSIONS[scenario]}
                />
              )}
              <output
                aria-label="Decision result"
                className="whitespace-pre-wrap text-muted-foreground text-xs"
              >
                {answers.length === 0 ? "No answer yet" : answers.join("\n")}
              </output>
            </section>
            <section
              aria-label="Documents"
              className="flex min-w-0 flex-col gap-4"
            >
              <div className="flex flex-wrap gap-1">
                {DOC_STATES.map((item) => (
                  <Button
                    aria-pressed={docState === item}
                    key={item}
                    onClick={chooseDocState}
                    size="sm"
                    value={item}
                    variant={docState === item ? "secondary" : "ghost"}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <div className="flex h-[540px] min-w-0 flex-col overflow-hidden rounded-xl bg-background">
                <DocsView docs={docs} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </MarkdownProvider>
  );
}
