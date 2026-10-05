"use client";

import { ColorControl } from "dialkit";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const PALETTE_HEX = /^#[\da-f]{6}([\da-f]{2})?$/i;

// DialKit also accepts CSS color spaces; project palettes store sRGB hex.
function paletteHex(value: string): string | null {
  if (PALETTE_HEX.test(value)) {
    return value;
  }
  if (!CSS.supports("color", value)) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const rgba = context.getImageData(0, 0, 1, 1).data;
  const channels = rgba[3] === 255 ? rgba.slice(0, 3) : rgba;
  return `#${Array.from(channels, (channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function ProjectBrandColor({
  role,
  value,
  onChange,
}: {
  role: string;
  value: string | undefined;
  onChange: (role: string, color: string) => void;
}) {
  const changeColor = useCallback(
    (color: string) => {
      const hex = paletteHex(color);
      if (hex) {
        onChange(role, hex);
      }
    },
    [onChange, role]
  );
  return (
    <div
      className={cn(
        "min-w-0 rounded-md p-[9px]",
        "[&_.dialkit-color-control]:grid! [&_.dialkit-color-control]:h-auto! [&_.dialkit-color-control]:grid-cols-[32px_minmax(0,1fr)] [&_.dialkit-color-control]:gap-x-[9px]! [&_.dialkit-color-control]:gap-y-0! [&_.dialkit-color-control]:bg-transparent! [&_.dialkit-color-control]:p-0! [&_.dialkit-color-control]:shadow-none!",
        "[&_.dialkit-color-label]:col-start-2 [&_.dialkit-color-label]:row-start-1 [&_.dialkit-color-label]:min-w-0 [&_.dialkit-color-label]:translate-y-0! [&_.dialkit-color-label]:truncate [&_.dialkit-color-label]:font-normal! [&_.dialkit-color-label]:text-foreground! [&_.dialkit-color-label]:text-sm! [&_.dialkit-color-label]:leading-[18px]!",
        "[&_.dialkit-color-inputs]:contents!",
        "[&_.dialkit-color-value]:col-start-2 [&_.dialkit-color-value]:row-start-2 [&_.dialkit-color-value]:w-full! [&_.dialkit-color-value]:rounded-sm [&_.dialkit-color-value]:p-0! [&_.dialkit-color-value]:font-normal! [&_.dialkit-color-value]:text-left! [&_.dialkit-color-value]:text-muted-foreground! [&_.dialkit-color-value]:text-xs! [&_.dialkit-color-value]:tabular-nums [&_.dialkit-color-value]:leading-5 [&_.dialkit-color-value]:focus-visible:outline-2 [&_.dialkit-color-value]:focus-visible:outline-ring [&_.dialkit-color-value]:focus-visible:outline-solid",
        "[&_.dialkit-color-swatch]:hover:transform-none! [&_.dialkit-color-swatch]:col-start-1 [&_.dialkit-color-swatch]:row-span-2 [&_.dialkit-color-swatch]:row-start-1 [&_.dialkit-color-swatch]:h-7! [&_.dialkit-color-swatch]:w-8! [&_.dialkit-color-swatch]:rounded-md! [&_.dialkit-color-swatch]:shadow-none! [&_.dialkit-color-swatch]:focus-visible:outline-2 [&_.dialkit-color-swatch]:focus-visible:outline-ring [&_.dialkit-color-swatch]:focus-visible:outline-solid [&_.dialkit-color-swatch]:focus-visible:outline-offset-2"
      )}
    >
      <ColorControl
        label={role.charAt(0).toUpperCase() + role.slice(1)}
        onChange={changeColor}
        value={value ?? ""}
      />
    </div>
  );
}
