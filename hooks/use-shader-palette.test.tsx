import { expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useShaderPalette } from "./use-shader-palette";

it("preserves duplicate stops and their identities across edit, reorder, add and remove", () => {
  const changed = mock();
  const hook = renderHook(() => {
    const [value, setValue] = useState(["#ffffff", "#ffffff", "#000000"]);
    return useShaderPalette({
      max: 4,
      min: 1,
      onChange: (next) => {
        changed(next);
        setValue(next);
      },
      value,
    });
  });
  const ids = hook.result.current.stops.map((item) => item.id);
  act(() => hook.result.current.move(ids[0], 2));
  expect(hook.result.current.stops.map((item) => item.id)).toEqual([
    ids[1],
    ids[2],
    ids[0],
  ]);
  act(() => hook.result.current.edit(ids[0], "#ff000080"));
  expect(hook.result.current.stops[2]).toEqual({
    color: "#ff000080",
    id: ids[0],
  });
  act(() => hook.result.current.add());
  expect(hook.result.current.stops).toHaveLength(4);
  act(() => hook.result.current.add());
  expect(hook.result.current.stops).toHaveLength(4);
  act(() => hook.result.current.remove(ids[2]));
  expect(hook.result.current.stops[0].id).toBe(ids[1]);
  expect(changed).toHaveBeenCalledTimes(4);
});

it("enforces the lower bound and accepts external Discard without losing remaining row focus IDs", () => {
  const changed = mock();
  const hook = renderHook(
    ({ value }) => useShaderPalette({ onChange: changed, value }),
    { initialProps: { value: ["#ffffff"] } }
  );
  const { id } = hook.result.current.stops[0];
  act(() => hook.result.current.remove(id));
  expect(changed).not.toHaveBeenCalled();
  hook.rerender({ value: ["#000000"] });
  expect(hook.result.current.stops).toEqual([{ color: "#000000", id }]);
});
