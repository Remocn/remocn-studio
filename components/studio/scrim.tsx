"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Scrim({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-background/70 p-6", className)}>
      {children}
    </div>
  );
}
