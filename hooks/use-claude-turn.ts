"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { promptClaude } from "@/lib/studio/claude";
import type { SidecarError } from "@/lib/studio/sidecar";
import type {
  ClaudeEvent,
  ContextUsage,
  EffortLevel,
  PromptAttachment,
  PromptResult,
} from "@/shared/ipc";

export type ActivityState = "done" | "failed" | "running";

export interface ActivityEntry {
  id: string;
  input: unknown;
  kind: "activity";
  name: string;
  result: string | null;
  state: ActivityState;
}

export interface UserEntry {
  attachments: readonly PromptAttachment[];
  id: string;
  kind: "user";
  text: string;
}

export type TurnEntry =
  | ActivityEntry
  | UserEntry
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "notice"; text: string };

export interface TurnSettings {
  cwd: string | null;
  effort: EffortLevel | null;
  model: string | null;
}

export interface ClaudeTurn {
  context: ContextUsage | null;
  entries: TurnEntry[];
  error: string | null;
  isRunning: boolean;
  send: (prompt: string, attachments?: readonly PromptAttachment[]) => void;
  sessionId: string | null;
  stop: () => void;
}

export function useClaudeTurn({
  cwd,
  effort,
  model,
}: TurnSettings): ClaudeTurn {
  const [entries, setEntries] = useState<TurnEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<ContextUsage | null>(null);
  const inflight = useRef<Fiber.Fiber<PromptResult, SidecarError> | null>(null);

  const stop = useCallback(() => {
    const fiber = inflight.current;
    if (fiber !== null) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const send = useCallback(
    (prompt: string, attachments: readonly PromptAttachment[] = []) => {
      const trimmed = prompt.trim();
      const isEmpty = trimmed.length === 0 && attachments.length === 0;
      if (cwd === null || isEmpty || inflight.current !== null) {
        return;
      }

      setError(null);
      setIsRunning(true);
      setEntries((current) => [
        ...current,
        {
          attachments,
          id: `user-${current.length}`,
          kind: "user",
          text: trimmed,
        },
      ]);

      const turn = promptClaude(
        { attachments, cwd, effort, model, prompt: trimmed, sessionId },
        (event) => {
          if (event.type === "session") {
            setSessionId(event.sessionId);
            return;
          }
          setEntries((current) => fold(current, event));
        }
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            inflight.current = null;
            setIsRunning(false);

            if (exit._tag === "Failure") {
              setError(causeMessage(exit.cause));
              return;
            }

            if (exit.value.sessionId !== null) {
              setSessionId(exit.value.sessionId);
            }
            if (exit.value.context !== null) {
              setContext(exit.value.context);
            }
            setError(exit.value.failure?.message ?? null);
          })
        )
      );

      inflight.current = Effect.runFork(turn);
    },
    [cwd, effort, model, sessionId]
  );

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({ context, entries, error, isRunning, send, sessionId, stop }),
    [context, entries, error, isRunning, send, sessionId, stop]
  );
}

function fold(entries: TurnEntry[], event: ClaudeEvent): TurnEntry[] {
  if (event.type === "text") {
    return appendText(entries, event.text);
  }

  if (event.type === "tool_use") {
    return [
      ...entries,
      {
        id: event.id,
        input: event.input,
        kind: "activity",
        name: event.name,
        result: null,
        state: "running",
      },
    ];
  }

  if (event.type === "tool_result") {
    return entries.map((entry) =>
      entry.kind === "activity" && entry.id === event.id
        ? {
            ...entry,
            result: event.text,
            state: event.isError ? "failed" : "done",
          }
        : entry
    );
  }

  if (event.type === "notice") {
    return [
      ...entries,
      { id: `notice-${entries.length}`, kind: "notice", text: event.message },
    ];
  }

  return entries;
}

function appendText(entries: TurnEntry[], text: string): TurnEntry[] {
  const last = entries.at(-1);

  if (last?.kind === "assistant") {
    return [...entries.slice(0, -1), { ...last, text: last.text + text }];
  }

  return [
    ...entries,
    { id: `assistant-${entries.length}`, kind: "assistant", text },
  ];
}
