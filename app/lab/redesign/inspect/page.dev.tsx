"use client";

import { useCallback, useMemo, useState } from "react";
import { PropsPanel } from "@/components/studio/props-pane";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PendingComment } from "@/hooks/use-inspect";
import type { TuningField, TuningTarget } from "@/lib/studio/preview";
import type { TuningValue } from "@/shared/ipc";

function field(
  group: string,
  label: string,
  path: string,
  type: TuningField["type"],
  value: TuningValue,
  overrides: Partial<TuningField> = {}
): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group,
    label,
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path,
    step: null,
    targetId: "title",
    type,
    value,
    ...overrides,
  };
}

const FIELDS = [
  field("Transform", "Position", "style.translate", "translate", "120px 80px"),
  field("Transform", "Scale", "style.scale", "scale", "1 1"),
  field("Transform", "Rotation", "style.rotate", "rotation-css", "0deg"),
  field(
    "Transform",
    "Origin",
    "style.transformOrigin",
    "transform-origin",
    "50% 50%"
  ),
  field("Layer", "Opacity", "style.opacity", "number", 1, {
    max: 1,
    min: 0,
    step: 0.01,
  }),
  field("Layer", "Visible", "visible", "boolean", true),
  field(
    "Typography",
    "Text",
    "children",
    "text-content",
    "Make something worth watching."
  ),
  field(
    "Typography",
    "Font family",
    "style.fontFamily",
    "font-family",
    "Inter"
  ),
  field("Typography", "Font size", "style.fontSize", "number", 72, {
    max: 160,
    min: 12,
    step: 1,
  }),
  field("Typography", "Weight", "style.fontWeight", "enum", "500", {
    options: ["400", "500", "600", "700"],
  }),
  field("Typography", "Alignment", "style.textAlign", "enum", "left", {
    options: ["left", "center", "right"],
  }),
  field("Fill", "Color", "style.color", "color", "#F5F5F5"),
  field("Fill", "Source", "src", "asset", "welcome-ribbon.svg"),
  field("Parameters", "Anchor", "anchor", "uv-coordinate", [0.5, 0.5]),
  field("Parameters", "Angle", "angle", "rotation-degrees", 45),
  field(
    "Parameters",
    "Labels",
    "labels",
    "array",
    ["Idea", "Create", "Export"],
    { arrayItemType: "text-content", newItemDefault: "New label" }
  ),
  field("Timing", "From", "from", "number", 0, { max: 150, min: 0, step: 1 }),
  field("Timing", "Duration", "durationInFrames", "number", 150, {
    max: 300,
    min: 1,
    step: 1,
  }),
];
const ORIGINALS = Object.fromEntries(
  FIELDS.map((item) => [item.path, item.value])
);
const FRAMES = { frameOf: () => 42, onFrame: () => () => undefined };
const noop = () => undefined;

export default function InspectorFixture() {
  const [fields, setFields] = useState(FIELDS);
  const [collapsed, setCollapsed] = useState<readonly string[]>([]);
  const target = useMemo<TuningTarget>(
    () => ({
      componentName: "OpeningTitle",
      fields,
      identity: null,
      instanceId: "title",
      instances: 1,
      keys: fields.map((item) => item.path),
      name: "Opening title",
      ordinal: 1,
      origin: null,
      targetId: "title",
      where: { column: 1, file: "/fixture/src/OpeningTitle.tsx", line: 12 },
    }),
    [fields]
  );
  const card = useMemo<PendingComment>(
    () => ({
      assetBase: "http://localhost:3000/design-system/",
      assets: ["welcome-ribbon.svg"],
      element: {
        column: 1,
        component: "OpeningTitle",
        composition: "Launch film",
        file: "/fixture/src/OpeningTitle.tsx",
        fps: 30,
        frame: 42,
        html: "<h1>Make something worth watching.</h1>",
        line: 12,
        scene: null,
        stack: [],
      },
      fonts: ["Inter", "Geist Mono", "Arial"],
      frames: {},
      open: 0,
      originals: { title: ORIGINALS },
      rect: { height: 0.3, width: 0.8, x: 0.1, y: 0.2 },
      statuses: {},
      targets: [target],
      tuning: target,
      video: { durationInFrames: 150, fps: 30, height: 1080, width: 1920 },
      window: { from: 0, until: 150 },
    }),
    [target]
  );
  const change = useCallback(
    (path: string, value: TuningValue) =>
      setFields((current) =>
        current.map((item) => (item.path === path ? { ...item, value } : item))
      ),
    []
  );
  const reset = useCallback(
    (paths?: readonly string[]) =>
      setFields((current) =>
        current.map((item) =>
          !paths || paths.includes(item.path)
            ? { ...item, value: ORIGINALS[item.path] }
            : item
        )
      ),
    []
  );
  const toggle = useCallback(
    (group: string) =>
      setCollapsed((current) =>
        current.includes(group)
          ? current.filter((item) => item !== group)
          : [...current, group]
      ),
    []
  );
  const clear = useCallback(() => reset(), [reset]);
  return (
    <TooltipProvider>
      <main className="mx-auto h-dvh w-[340px] max-w-full bg-background">
        <PropsPanel
          card={card}
          cwd="/fixture"
          frames={FRAMES}
          groups={{ collapsed, toggle }}
          onCancel={clear}
          onChange={change}
          onChangeText={noop}
          onReplay={noop}
          onReset={reset}
          onSeek={noop}
          onSubmit={noop}
          refusal={null}
          target={target}
        />
      </main>
    </TooltipProvider>
  );
}
