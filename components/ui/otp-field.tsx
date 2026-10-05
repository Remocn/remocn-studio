"use client";

import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field";
import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function OTPField({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof OTPFieldPrimitive.Root> & {
  size?: "default" | "lg";
}): React.ReactElement {
  return (
    <OTPFieldPrimitive.Root
      className={cn(
        "flex items-center gap-2 has-disabled:opacity-45",
        className
      )}
      data-size={size}
      data-slot="otp-field"
      {...props}
    />
  );
}

export function OTPFieldInput({
  className,
  ...props
}: React.ComponentProps<typeof OTPFieldPrimitive.Input>): React.ReactElement {
  return (
    <OTPFieldPrimitive.Input
      className={cn(
        "relative size-8 min-w-0 rounded-xl bg-control text-center text-sm text-foreground leading-8 outline-none transition-colors in-[[data-slot=otp-field][data-size=lg]]:size-9 in-[[data-slot=otp-field][data-size=lg]]:text-base in-[[data-slot=otp-field][data-size=lg]]:leading-9 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:bg-destructive/10",
        className
      )}
      data-slot="otp-field-input"
      spellCheck={false}
      {...props}
    />
  );
}

export function OTPFieldSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>): React.ReactElement {
  return (
    <OTPFieldPrimitive.Separator
      render={
        <Separator
          className={cn(
            "rounded-full bg-input data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-3",
            className
          )}
          orientation="horizontal"
          {...props}
        />
      }
    />
  );
}

export { OTPFieldPrimitive };
