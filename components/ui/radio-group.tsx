"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type React from "react";
import { cn } from "@/lib/utils";

export function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props): React.ReactElement {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

export function Radio({
  className,
  ...props
}: RadioPrimitive.Root.Props): React.ReactElement {
  return (
    <RadioPrimitive.Root
      className={cn(
        "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:bg-destructive/10 data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      data-slot="radio"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="absolute inset-0 flex items-center justify-center rounded-full before:size-1.5 before:rounded-full before:bg-primary-foreground data-unchecked:hidden data-checked:bg-primary"
        data-slot="radio-indicator"
      />
    </RadioPrimitive.Root>
  );
}

export { Radio as RadioGroupItem, RadioGroupPrimitive, RadioPrimitive };
