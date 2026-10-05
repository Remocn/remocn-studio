"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium text-sm outline-none transition-[color,background-color,opacity] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45 data-loading:select-none data-loading:text-transparent [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-8 px-3",
        icon: "size-8",
        "icon-lg": "size-9",
        "icon-sm": "size-7",
        "icon-xl": "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 px-3.5",
        sm: "h-7 px-2.5",
        xl: "h-10 px-4",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white",
        "destructive-outline":
          "bg-control text-destructive-foreground hover:bg-destructive/10 data-pressed:bg-destructive/10 *:data-[slot=button-loading-indicator]:text-destructive-foreground",
        ghost:
          "text-foreground hover:bg-accent data-pressed:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground *:data-[slot=button-loading-indicator]:text-foreground",
        "key-action":
          "bg-key-action text-key-action-foreground hover:bg-key-action/90 data-pressed:bg-key-action/90 *:data-[slot=button-loading-indicator]:text-key-action-foreground",
        link: "text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "bg-control text-foreground hover:bg-accent data-pressed:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground *:data-[slot=button-loading-indicator]:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent data-pressed:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground *:data-[slot=button-loading-indicator]:text-secondary-foreground",
      },
    },
  }
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  loading?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    "aria-disabled": loading || undefined,
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none absolute"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}
