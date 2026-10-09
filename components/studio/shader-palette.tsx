"use client";

import { formatHex, formatHex8, parse } from "culori";
import { ColorControl } from "dialkit";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import { useShaderPalette } from "@/hooks/use-shader-palette";

export function ShaderPalette({
  label,
  value,
  min = 1,
  max = 10,
  onChange,
}: {
  label: string;
  value: readonly string[];
  min?: number;
  max?: number;
  onChange: (value: string[]) => void;
}) {
  const palette = useShaderPalette({ max, min, onChange, value });
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const key = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.value;
      const from = palette.stops.findIndex((item) => item.id === id);
      const destinations: Record<string, number> = {
        ArrowDown: from + 1,
        ArrowUp: from - 1,
        End: palette.stops.length - 1,
        Home: 0,
      };
      const to = destinations[event.key];
      if (to === undefined) {
        return;
      }
      event.preventDefault();
      palette.move(id, to);
    },
    [palette]
  );
  const down = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    drag.current = event.currentTarget.value;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const move = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!(drag.current && root.current)) {
        return;
      }
      const rows = [
        ...root.current.querySelectorAll<HTMLElement>("[data-color-stop]"),
      ];
      const index = rows.findIndex((row) => {
        const bounds = row.getBoundingClientRect();
        return event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      });
      if (index >= 0) {
        palette.move(drag.current, index);
      }
    },
    [palette]
  );
  const up = useCallback(() => {
    drag.current = null;
  }, []);
  return (
    <div className="grid gap-2" ref={root}>
      <span className="dialkit-composite-label">{label}</span>
      <p className="text-muted-foreground text-xs">
        Drag a color handle or use its arrow keys to reorder.
      </p>
      {palette.stops.map((item, index) => (
        <div
          className="flex min-w-0 items-center gap-1"
          data-color-stop={item.id}
          key={item.id}
        >
          <Button
            aria-label={`Move color ${index + 1}`}
            className="cursor-grab touch-none"
            onKeyDown={key}
            onPointerCancel={up}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            size="icon-xs"
            value={item.id}
            variant="ghost"
          >
            ↕
          </Button>
          <PaletteColor
            canRemove={palette.stops.length > min}
            color={item.color}
            edit={palette.edit}
            id={item.id}
            index={index}
            remove={palette.remove}
          />
        </div>
      ))}
      <Button
        disabled={palette.stops.length >= max}
        onClick={palette.add}
        size="xs"
        variant="outline"
      >
        Add color
      </Button>
    </div>
  );
}

function PaletteColor({
  id,
  color,
  index,
  edit,
  remove,
  canRemove,
}: {
  id: string;
  color: string;
  index: number;
  edit: (id: string, value: string) => void;
  remove: (id: string) => void;
  canRemove: boolean;
}) {
  const change = useCallback(
    (value: string) => {
      const parsed = parse(value);
      if (!parsed) {
        return;
      }
      const hex =
        parsed.alpha !== undefined && parsed.alpha < 1
          ? formatHex8(parsed)
          : formatHex(parsed);
      if (hex) {
        edit(id, hex);
      }
    },
    [edit, id]
  );
  const removeColor = useCallback(() => remove(id), [id, remove]);
  return (
    <>
      <div className="min-w-0 flex-1">
        <ColorControl
          label={`Color ${index + 1}`}
          onChange={change}
          value={color}
        />
      </div>
      <Button
        aria-label={`Remove color ${index + 1}`}
        disabled={!canRemove}
        onClick={removeColor}
        size="icon-xs"
        variant="ghost"
      >
        −
      </Button>
    </>
  );
}
