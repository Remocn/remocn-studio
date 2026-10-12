import type React from "react";
import { cn } from "@/lib/utils";

export function AboveComposer({
  children,
  className,
  isLeaving = false,
}: {
  children: React.ReactNode;
  className?: string;
  isLeaving?: boolean;
}) {
  return (
    <div
      className="mb-2 shrink-0 animate-card-in px-4 pt-1 transition-opacity duration-fast ease-out data-leaving:pointer-events-none data-leaving:opacity-0"
      data-leaving={isLeaving ? "" : undefined}
      inert={isLeaving || undefined}
    >
      <div className={cn("mx-auto w-full max-w-2xl", className)}>
        {children}
      </div>
    </div>
  );
}

export function NoticeCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-control px-3 py-2.5",
        className
      )}
      data-slot="notice-card"
      {...props}
    />
  );
}
