"use client";

import { useCallback } from "react";
import type { WriteFailureCard as Failure } from "@/hooks/use-code-writes";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TITLE = "Some values could not be written into the code";

/**
 * The one question a Send with code edits can raise, and it is asked over a
 * disk nothing has touched: the first write attempt is whole-or-nothing, so
 * "no" costs nothing and leaves the composer exactly as it was.
 *
 * It is shaped like the permission card and is not one: the write is the
 * studio's own doing, not a tool asking for permission.
 */
export function WriteFailureCard({
  agent,
  failure,
  onAnswer,
}: {
  agent: string;
  failure: Failure;
  onAnswer: (accept: boolean) => void;
}) {
  const choose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onAnswer(event.currentTarget.value === "yes");
    },
    [onAnswer]
  );

  return (
    <Card aria-label={TITLE} data-slot="write-failure-card">
      <CardHeader className="gap-1 p-4">
        <CardTitle className="text-sm">{TITLE}</CardTitle>
        <ul className="flex flex-col gap-1 rounded-md bg-muted/50 px-2.5 py-1.5">
          {failure.refused.map((refusal) => (
            <li
              className="wrap-break-word text-muted-foreground text-xs"
              key={`${refusal.label} ${refusal.reason}`}
            >
              <span className="text-foreground">{refusal.label}</span> —{" "}
              {refusal.reason}
            </li>
          ))}
        </ul>
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex flex-col">
          <button
            className="-mx-1 flex min-h-9 pointer-coarse:min-h-11 flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 active:bg-accent disabled:pointer-events-none disabled:opacity-45"
            onClick={choose}
            type="button"
            value="yes"
          >
            <span className="shrink-0 font-medium text-sm">Send anyway</span>
            <span className="min-w-0 text-pretty text-muted-foreground text-xs">
              {failure.kept === 0
                ? `Ask ${agent} for all of them`
                : `Write the ${failure.kept} that worked and ask ${agent} for the rest`}
            </span>
          </button>
          <button
            className="-mx-1 flex min-h-9 pointer-coarse:min-h-11 flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 active:bg-accent disabled:pointer-events-none disabled:opacity-45"
            onClick={choose}
            type="button"
            value="no"
          >
            <span className="shrink-0 text-destructive text-sm">Cancel</span>
            <span className="min-w-0 text-pretty text-muted-foreground text-xs">
              Nothing is written and nothing is sent
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
