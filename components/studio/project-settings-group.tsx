import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { SettingsGroup } from "./settings-group";

export function ProjectSettingsGroup(
  props: Parameters<typeof SettingsGroup>[0]
) {
  return <SettingsGroup {...props} />;
}

export function ProjectSettingsRow({
  title,
  description,
  htmlFor,
  children,
  layout = "row",
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  layout?: "row" | "multiline";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 @min-[480px]:gap-6 gap-3",
        layout === "multiline"
          ? "@min-[480px]:grid-cols-[180px_minmax(0,1fr)] @min-[480px]:items-start @min-[480px]:gap-4 py-2"
          : "@min-[480px]:grid-cols-[minmax(0,1fr)_280px] items-center py-3"
      )}
    >
      <div
        className={cn(
          "min-w-0 space-y-1",
          layout === "multiline" && "@min-[480px]:pt-2.5"
        )}
      >
        {htmlFor ? (
          <label
            className={cn(
              "leading-5",
              layout === "multiline" ? "text-sm" : "text-[14px]"
            )}
            htmlFor={htmlFor}
          >
            {title}
          </label>
        ) : (
          <p className="text-[14px] leading-5">{title}</p>
        )}
        {description ? (
          <p className="break-words text-muted-foreground text-sm leading-[18px]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
