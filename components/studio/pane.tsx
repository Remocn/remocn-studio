import { cn } from "@/lib/utils";

function Pane({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}
      data-slot="pane"
      {...props}
    />
  );
}

function PaneHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2 pl-3",
        className
      )}
      data-slot="pane-header"
      {...props}
    />
  );
}

function PaneTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "min-w-0 truncate font-medium text-muted-foreground text-xs",
        className
      )}
      data-slot="pane-title"
      {...props}
    />
  );
}

function PaneActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-1", className)}
      data-slot="pane-actions"
      {...props}
    />
  );
}

function PaneBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        className
      )}
      data-slot="pane-body"
      {...props}
    />
  );
}

export { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle };
