"use client";

import { useCallback, useRef, useState } from "react";

interface ColorStop {
  readonly color: string;
  readonly id: string;
}
const stop = (color: string): ColorStop => ({ color, id: crypto.randomUUID() });

export function useShaderPalette({
  value,
  min = 1,
  max = 10,
  onChange,
}: {
  value: readonly string[];
  min?: number;
  max?: number;
  onChange: (value: string[]) => void;
}) {
  const [stops, setStops] = useState(() => value.map(stop));
  const current = useRef(stops);
  current.current = stops;
  if (
    stops.length !== value.length ||
    stops.some((item, index) => item.color !== value[index])
  ) {
    const next = value.map((color, index) => ({
      color,
      id: stops[index]?.id ?? crypto.randomUUID(),
    }));
    current.current = next;
    setStops(next);
  }
  const publish = useCallback(
    (next: ColorStop[]) => {
      current.current = next;
      setStops(next);
      onChange(next.map((item) => item.color));
    },
    [onChange]
  );
  const edit = useCallback(
    (id: string, color: string) => {
      publish(
        current.current.map((item) =>
          item.id === id ? { ...item, color } : item
        )
      );
    },
    [publish]
  );
  const add = useCallback(() => {
    if (current.current.length >= max) {
      return;
    }
    publish([
      ...current.current,
      stop(current.current.at(-1)?.color ?? "#ffffff"),
    ]);
  }, [max, publish]);
  const remove = useCallback(
    (id: string) => {
      if (current.current.length <= min) {
        return;
      }
      publish(current.current.filter((item) => item.id !== id));
    },
    [min, publish]
  );
  const move = useCallback(
    (id: string, to: number) => {
      const next = [...current.current];
      const from = next.findIndex((item) => item.id === id);
      if (from < 0 || to < 0 || to >= next.length || from === to) {
        return;
      }
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      publish(next);
    },
    [publish]
  );
  return { add, edit, move, remove, stops };
}
