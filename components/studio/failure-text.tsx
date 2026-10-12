"use client";

import type { AriaRole } from "react";
import { ChevronRightIcon, CopyIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCopyCommand } from "@/hooks/use-copy-command";
import { useWordedFailure } from "@/hooks/use-worded-failure";
import { cn } from "@/lib/utils";

export function FailureText({
  align = "start",
  className,
  fallback,
  role,
  text,
}: {
  align?: "center" | "start";
  className?: string;
  fallback: string;
  role?: AriaRole;
  text: string | null | undefined;
}) {
  const failure = useWordedFailure(text, fallback);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        align === "center" ? "items-center" : "items-start"
      )}
    >
      <p className={cn("break-words", className)} role={role}>
        {failure.sentence}
      </p>
      {failure.details === null ? null : (
        <FailureDetails
          className={align === "center" ? "items-center" : "items-start"}
          details={failure.details}
        />
      )}
    </div>
  );
}

export function FailureDetails({
  className,
  details,
}: {
  className?: string;
  details: string;
}) {
  const { copied, onCopy } = useCopyCommand();

  return (
    <Collapsible
      className={cn(
        "flex w-full min-w-0 flex-col items-start gap-1",
        className
      )}
    >
      <CollapsibleTrigger className="group/details flex items-center gap-0.5 text-2xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3 transition-transform group-data-panel-open/details:rotate-90"
        />
        Details
      </CollapsibleTrigger>
      <CollapsiblePanel className="w-full">
        <div className="flex min-w-0 flex-col gap-1 text-left">
          <pre
            className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-2 py-1.5 font-mono text-2xs text-muted-foreground [overflow-wrap:anywhere]"
            data-selectable
          >
            {details}
          </pre>
          <Button
            className="self-start"
            onClick={onCopy}
            size="xs"
            value={details}
            variant="ghost"
          >
            <CopyIcon data-icon="inline-start" />
            {copied === details ? "Copied" : "Copy details"}
          </Button>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
