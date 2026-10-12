import { type ComponentType, useCallback, useEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  isRemoved,
  type ObjectDocument,
  sendStudioMessage,
  useStudioContext,
  useStudioObject,
  type Value,
} from "./index";

export interface ShaderAdapterProps {
  readonly fps: number;
  readonly frame: number;
  readonly onError: (message: string) => void;
  readonly onReady: () => void;
  readonly values: Readonly<Record<string, Value | undefined>>;
}

export type ShaderRegistry = Readonly<
  Record<
    string,
    {
      readonly revision: string;
      readonly component: ComponentType<ShaderAdapterProps>;
    }
  >
>;

type ShaderObject = ObjectDocument["objects"][number];

export function shaderInterval(
  values: ShaderObject["values"],
  duration: number
): { start: number; end: number } {
  const start = values.startFrame;
  const end = values.followSceneEnd ? duration : values.endFrame;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > duration
  ) {
    throw new Error(
      "The shader trim no longer fits this scene. Adjust its start or end in Inspect."
    );
  }
  return { end, start };
}

function ShaderLayer({
  object,
  registry,
  frame,
  fps,
}: {
  object: ShaderObject;
  registry: ShaderRegistry;
  frame: number;
  fps: number;
}) {
  const context = useStudioContext();
  const managed = useStudioObject(object.id);
  const values = { ...object.values, ...context.drafts[object.id] };
  const implementation = object.shader && registry[object.shader.slug];
  const operation = context.document.operations.find(
    (item) => item.kind === "create" && item.objectId === object.id
  );
  const onReady = useCallback(() => {
    if (!(operation && object.shader)) {
      return;
    }
    sendStudioMessage({
      generation: context.generation,
      objectId: object.id,
      operationId: operation.id,
      slotId: object.shader.slotId,
      type: "shader.ready",
      video: context.document.video,
    });
  }, [
    context.generation,
    context.document.video,
    object.id,
    object.shader,
    operation,
  ]);
  const onError = useCallback(
    (message: string) => {
      sendStudioMessage({
        generation: context.generation,
        message,
        objectId: object.id,
        type: "shader.error",
        video: context.document.video,
      });
    },
    [context.generation, context.document.video, object.id]
  );
  if (!implementation || implementation.revision !== object.shader?.revision) {
    throw new Error(
      `${object.label}: the saved shader implementation is missing or has a different version.`
    );
  }
  const Component = implementation.component;
  const { opacity } = values;
  if (
    typeof opacity !== "number" ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1
  ) {
    throw new Error(`${object.label}: invalid opacity.`);
  }
  return (
    <div {...managed.bind} style={{ inset: 0, opacity, position: "absolute" }}>
      <Component
        fps={fps}
        frame={frame}
        onError={onError}
        onReady={onReady}
        values={values}
      />
    </div>
  );
}

export function StudioShaderSlot({
  id,
  sceneId = null,
  label,
  durationInFrames,
  sourceRevision,
  registry,
}: {
  readonly id: string;
  readonly sceneId?: string | null;
  readonly label: string;
  readonly durationInFrames: number;
  readonly sourceRevision: string;
  readonly registry: ShaderRegistry;
}) {
  const context = useStudioContext();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const from = context.globalFrame - frame;
  useEffect(
    () =>
      context.targets.register({
        contract: 1,
        durationInFrames,
        fps,
        from,
        label,
        sceneId,
        slotId: id,
        sourceRevision,
      }),
    [
      context.targets,
      durationInFrames,
      fps,
      from,
      id,
      label,
      sceneId,
      sourceRevision,
    ]
  );
  if (
    !Number.isInteger(durationInFrames) ||
    durationInFrames < 1 ||
    !Number.isInteger(from) ||
    from < 0
  ) {
    throw new Error(`${label}: the shader slot needs a valid scene range.`);
  }
  const objects = context.document.objects.filter(
    (object) =>
      object.shader?.slotId === id && !isRemoved(context.document, object.id)
  );
  const layers = objects
    .map((object) => {
      if (object.parentId !== sceneId) {
        throw new Error(
          `${object.label}: the shader belongs to a different scene.`
        );
      }
      const values = { ...object.values, ...context.drafts[object.id] };
      const interval = shaderInterval(values, durationInFrames);
      const { order } = values;
      if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
        throw new Error(`${object.label}: invalid layer order.`);
      }
      return { interval, object, order };
    })
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.object.id.localeCompare(right.object.id)
    );
  return (
    <div
      data-studio-shader-slot={id}
      style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
    >
      {layers
        .filter(
          ({ interval }) => frame >= interval.start && frame < interval.end
        )
        .map(({ object }) => (
          <ShaderLayer
            fps={fps}
            frame={frame}
            key={object.id}
            object={object}
            registry={registry}
          />
        ))}
    </div>
  );
}
