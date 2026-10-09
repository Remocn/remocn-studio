"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.ComponentPropsWithoutRef<"textarea"> &
  React.RefAttributes<HTMLTextAreaElement> & {
    size?: "sm" | "default" | "lg" | number;
    unstyled?: boolean;
  };

export function Textarea({
  className,
  size = "default",
  unstyled = false,
  ref,
  ...props
}: TextareaProps): React.ReactElement {
  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full rounded-xl bg-field text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-ring has-focus-visible:outline-offset-2 has-disabled:opacity-45 has-aria-invalid:bg-destructive/10",
          className
        ) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
    >
      <FieldPrimitive.Control
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        ref={ref}
        render={(defaultProps: React.ComponentProps<"textarea">) => (
          <textarea
            className={cn(
              "field-sizing-content min-h-17.5 w-full rounded-[inherit] px-3 py-[calc(--spacing(1.5)-1px)] text-foreground outline-none placeholder:text-muted-foreground/72 dark:placeholder:text-muted-foreground max-sm:min-h-20.5",
              size === "sm" &&
                "min-h-16.5 px-2.5 py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5",
              size === "lg" &&
                "min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5"
            )}
            data-slot="textarea"
            {...mergeProps(defaultProps, props)}
          />
        )}
        value={props.value}
      />
    </span>
  );
}

export { FieldPrimitive };
