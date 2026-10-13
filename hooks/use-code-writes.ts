"use client";

import { Effect, Exit } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Selection } from "@/hooks/use-selections";
import { causeMessage } from "@/lib/error-message";
import { editsOf, failuresOf, writtenFiles } from "@/lib/studio/code-writes";
import { writeCode } from "@/lib/studio/preview";
import { titleOf } from "@/lib/studio/tuning";
import type { CodeWritten } from "@/shared/ipc";

export interface WriteRefusal {
  readonly label: string;
  readonly reason: string;
}

/**
 * What the card asks about: nothing has been written, and these are the
 * changes that could not be. Answering yes lets the rest land and sends the
 * refused ones to the agent; answering no leaves the disk and the composer
 * exactly as they were.
 */
export interface WriteFailureCard {
  readonly kept: number;
  readonly refused: readonly WriteRefusal[];
}

export interface WriteOutcome {
  /** The selections whose edits were refused, by their index in the composer. */
  readonly failed: ReadonlySet<number>;
  readonly ok: boolean;
  readonly written: readonly { file: string; line: number | null }[];
}

export interface CodeWrites {
  answer: (accept: boolean) => void;
  card: WriteFailureCard | null;
  isWriting: boolean;
  run: (selections: readonly Selection[]) => Promise<WriteOutcome>;
}

export interface CodeWriteSettings {
  projectId: string | null;
  /** The write itself, injected so a test can answer without a sidecar. */
  write?: typeof writeCode;
}

const NOTHING: WriteOutcome = { failed: new Set(), ok: false, written: [] };

export function useCodeWrites({
  projectId,
  write = writeCode,
}: CodeWriteSettings): CodeWrites {
  const sidecar = useRef({ write });
  sidecar.current = { write };
  const [card, setCard] = useState<WriteFailureCard | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const waiting = useRef<((accept: boolean) => void) | null>(null);

  const answer = useCallback((accept: boolean) => {
    const settle = waiting.current;
    waiting.current = null;
    setCard(null);
    settle?.(accept);
  }, []);

  const asked = useCallback(
    async (
      selections: readonly Selection[],
      results: readonly CodeWritten[],
      accepted: () => Promise<readonly CodeWritten[] | null>
    ): Promise<WriteOutcome> => {
      const failed = failuresOf(results);

      setCard({
        kept: results.filter((result) => result.ok).length,
        refused: [...failed].map(([index, reason]) => ({
          label: labelOf(selections[index]),
          reason,
        })),
      });

      const accept = await new Promise<boolean>((resolve) => {
        waiting.current = resolve;
      });

      if (!accept) {
        return NOTHING;
      }

      const landed = await accepted();

      return landed === null
        ? { failed: indexesOf(failed), ok: true, written: [] }
        : {
            failed: indexesOf(failuresOf(landed)),
            ok: true,
            written: writtenFiles(landed),
          };
    },
    []
  );

  const run = useCallback(
    async (selections: readonly Selection[]): Promise<WriteOutcome> => {
      const edits = editsOf(selections);

      if (edits.length === 0) {
        return { failed: new Set(), ok: true, written: [] };
      }

      if (projectId === null) {
        return NOTHING;
      }

      setIsWriting(true);

      try {
        // Nothing lands until everything can: the first attempt is always
        // whole-or-nothing, so a card is a question about a disk that has not
        // been touched.
        const first = await Effect.runPromiseExit(
          sidecar.current.write({
            edits,
            partial: false,
            projectId,
          })
        );

        if (Exit.isFailure(first)) {
          return await asked(
            selections,
            everyEditRefused(edits, causeMessage(first.cause)),
            () => Promise.resolve(null)
          );
        }

        const failed = failuresOf(first.value.results);

        if (failed.size === 0) {
          return {
            failed: indexesOf(failed),
            ok: true,
            written: writtenFiles(first.value.results),
          };
        }

        return await asked(selections, first.value.results, async () => {
          const second = await Effect.runPromiseExit(
            sidecar.current.write({ edits, partial: true, projectId })
          );

          return Exit.isFailure(second) ? null : second.value.results;
        });
      } finally {
        setIsWriting(false);
      }
    },
    [asked, projectId]
  );

  return useMemo(
    () => ({ answer, card, isWriting, run }),
    [answer, card, isWriting, run]
  );
}

function indexesOf(failed: ReadonlyMap<number, string>): ReadonlySet<number> {
  return new Set(failed.keys());
}

function everyEditRefused(
  edits: readonly { id: string }[],
  message: string | null
): CodeWritten[] {
  return edits.map((edit) => ({
    file: "",
    id: edit.id,
    line: null,
    message: message ?? "the studio could not reach the preview",
    ok: false,
  }));
}

function labelOf(selection: Selection | undefined): string {
  if (selection === undefined) {
    return "Element";
  }

  const target = selection.tuning?.targets[selection.tuning.open];

  return target === undefined
    ? (selection.element.component ?? "Element")
    : titleOf(target);
}
