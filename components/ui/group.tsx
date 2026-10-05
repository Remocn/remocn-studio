"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const groupVariants = cva(
  "flex w-fit *:focus-visible:z-1 has-[>[data-slot=group]]:gap-2 *:has-focus-visible:z-1",
  {
    defaultVariants: {
      orientation: "horizontal",
    },
    variants: {
      orientation: {
        horizontal:
          "*:pointer-coarse:after:min-w-auto *:data-slot:has-[~[data-slot]]:rounded-e-none *:[[data-slot]~[data-slot]]:rounded-s-none",
        vertical:
          "flex-col *:pointer-coarse:after:min-h-auto *:data-slot:has-[~[data-slot]]:rounded-b-none *:[[data-slot]~[data-slot]]:rounded-t-none",
      },
    },
  }
);

export function Group({
  className,
  orientation,
  children,
  ...props
}: {
  className?: string;
  orientation?: VariantProps<typeof groupVariants>["orientation"];
  children: React.ReactNode;
} & React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(groupVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="group"
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}

export function GroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-muted px-3 text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
      className
    ),
    "data-slot": "group-text",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps(defaultProps, props),
    render,
  });
}

export function GroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: {
  className?: string;
} & React.ComponentProps<typeof Separator>): React.ReactElement {
  return (
    <Separator
      className={cn("pointer-events-none bg-transparent", className)}
      orientation={orientation}
      {...props}
    />
  );
}

export {
  Group as ButtonGroup,
  GroupSeparator as ButtonGroupSeparator,
  GroupText as ButtonGroupText,
};
