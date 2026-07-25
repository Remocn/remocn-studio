"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { promptClaude } from "@/lib/studio/claude";
import type { SidecarError } from "@/lib/studio/sidecar";
import type { ClaudeEvent, PromptResult } from "@/shared/ipc";

export type ActivityState = "done" | "failed" | "running";

export type TurnEntry =
  | { id: string; kind: "activity"; name: string; state: ActivityState }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "notice"; text: string }
  | { id: string; kind: "user"; text: string };

export interface ClaudeTurn {
  entries: TurnEntry[];
  error: string | null;
  isRunning: boolean;
  send: (prompt: string) => void;
  sessionId: string | null;
  stop: () => void;
}

export function useClaudeTurn(
  cwd: string | null,
  model: string | null
): ClaudeTurn {
  const [entries, setEntries] = useState<TurnEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inflight = useRef<Fiber.Fiber<PromptResult, SidecarError> | null>(null);

  const stop = useCallback(() => {
    const fiber = inflight.current;
    if (fiber !== null) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const send = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (cwd === null || trimmed.length === 0 || inflight.current !== null) {
        return;
      }

      setError(null);
      setIsRunning(true);
      setEntries((current) => [
        ...current,
        { id: `user-${current.length}`, kind: "user", text: trimmed },
      ]);

      const turn = promptClaude(
        { cwd, model, prompt: trimmed, sessionId },
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
            setError(exit.value.failure?.message ?? null);
          })
        )
      );

      inflight.current = Effect.runFork(turn);
    },
    [cwd, model, sessionId]
  );

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({ entries, error, isRunning, send, sessionId, stop }),
    [entries, error, isRunning, send, sessionId, stop]
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
        kind: "activity",
        name: describe(event.name, event.input),
        state: "running",
      },
    ];
  }

  if (event.type === "tool_result") {
    return entries.map((entry) =>
      entry.kind === "activity" && entry.id === event.id
        ? { ...entry, state: event.isError ? "failed" : "done" }
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

function describe(name: string, input: unknown): string {
  const target = subject(input);
  return target === null ? name : `${name} ${target}`;
}

function subject(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const fields = input as Record<string, unknown>;

  for (const key of ["file_path", "path", "command", "pattern", "url"]) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}
