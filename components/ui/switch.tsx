"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  size = "sm",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}): React.ReactElement {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex shrink-0 items-center rounded-full outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 data-disabled:cursor-not-allowed data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-45 motion-reduce:transition-none",
        size === "default"
          ? "h-[22px] w-[38px] p-[3px]"
          : "h-[18px] w-[30px] p-px",
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 transition-transform duration-150 motion-reduce:transition-none",
          size === "default"
            ? "rounded-full bg-white data-checked:translate-x-4"
            : "rounded-sm bg-background data-checked:translate-x-3"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { SwitchPrimitive };
