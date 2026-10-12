import type { ReactNode } from "react";

export function SidebarSlide({
  animate,
  children,
  offset,
  inactive = false,
}: {
  animate: boolean;
  children: ReactNode;
  offset: -1 | 0 | 1;
  inactive?: boolean;
}) {
  return (
    <div
      aria-hidden={inactive || undefined}
      className="h-full w-full motion-reduce:transition-none!"
      data-sidebar-slide
      inert={inactive || undefined}
      style={{
        transform: `translateX(${offset * 100}%)`,
        transition: animate
          ? "transform 200ms cubic-bezier(.32,.72,0,1)"
          : "none",
      }}
    >
      {children}
    </div>
  );
}
