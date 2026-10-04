import {
  GEOMETRY_KEYS,
  type GeometryBinding,
  type GeometryKey,
  type GeometryPose,
  type GeometryValues,
  IDENTITY_GEOMETRY_POSE,
  poseGeometry,
} from "../shared/studio-geometry";
import { managedIdentity } from "./managed-objects";
import type { PreviewCommand } from "./protocol";
import { parentAcrossRoot } from "./surface";

const DEGREES = /^-?[\d.]+deg$/;

export type GeometryConfig = Extract<
  PreviewCommand,
  { type: "studio.geometry.config" }
>;
export interface GeometryBetween {
  editing: "from" | "to";
  frames: { from: number; to: number } | null;
  kind: "entry" | "exit";
  other: GeometryValues;
}

export interface GeometryTarget {
  between: GeometryBetween | null;
  binding: GeometryBinding;
  bindingAttribute: string;
  bounds: Partial<
    Record<GeometryKey, { min: number | null; max: number | null }>
  >;
  frameAttribute: string | null;
  generation: string;
  node: HTMLElement;
  objectId: string;
  parentRotation: number;
  parentScale: number;
  pose: GeometryPose;
  poseAttribute: string | null;
  scale: number;
  values: GeometryValues;
  video: string;
}

export function geometryTarget(
  node: Element | null,
  config: GeometryConfig | null
): GeometryTarget | null {
  if (
    !(node instanceof HTMLElement && config && node.isConnected) ||
    node.getClientRects().length !== 1
  ) {
    return null;
  }
  const identity = managedIdentity(node);
  if (
    !identity ||
    identity.objectId !== config.objectId ||
    identity.generation !== config.generation ||
    identity.video !== config.video
  ) {
    return null;
  }
  const poseAttribute = node.getAttribute("data-studio-geometry-pose");
  const bindingAttribute = node.getAttribute("data-studio-geometry") ?? "null";
  const parsed = parseBinding(bindingAttribute, poseAttribute);
  if (!parsed) {
    return null;
  }
  const { binding, pose } = parsed;
  const fields = boundFields(binding, config);
  if (!fields) {
    return null;
  }
  const { bounds, values } = fields;
  if (
    values.width < 1 ||
    values.height < 1 ||
    !renderedGeometry(node, values)
  ) {
    return null;
  }
  const rendered = poseGeometry(values, pose);
  if (
    rendered.width < 1 ||
    rendered.height < 1 ||
    !GEOMETRY_KEYS.every((key) => Number.isFinite(rendered[key]))
  ) {
    return null;
  }
  if (!laidOutAt(node, rendered, pose)) {
    return null;
  }
  const inherited = parentTransform(node);
  if (!inherited) {
    return null;
  }
  const { parentRotation, parentScale } = inherited;
  const scale = parentScale * pose.scale;
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }
  if (!boxMatches(node, rendered, parentRotation, scale)) {
    return null;
  }
  return {
    ...identity,
    between: betweenOf(node),
    binding,
    bindingAttribute,
    bounds,
    frameAttribute: node.getAttribute("data-studio-geometry-frame"),
    node,
    parentRotation,
    parentScale,
    pose,
    poseAttribute,
    scale,
    values,
  };
}

function parseBinding(
  bindingAttribute: string,
  poseAttribute: string | null
): { binding: GeometryBinding; pose: GeometryPose } | null {
  let binding: GeometryBinding;
  let pose: GeometryPose;
  try {
    const parsed = JSON.parse(bindingAttribute);
    if (
      !parsed ||
      GEOMETRY_KEYS.some((key) =>
        key === "rotation" && parsed[key] === null
          ? false
          : typeof parsed[key] !== "string"
      )
    ) {
      return null;
    }
    binding = parsed;
    pose =
      poseAttribute === null
        ? IDENTITY_GEOMETRY_POSE
        : JSON.parse(poseAttribute);
    if (
      !(pose && Number.isFinite(pose.scale)) ||
      pose.scale <= 0 ||
      GEOMETRY_KEYS.some(
        (key) =>
          !Number.isFinite(pose.multiplier?.[key]) ||
          pose.multiplier[key] < 0.000_001 ||
          !Number.isFinite(pose.offset?.[key])
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const ids = Object.values(binding).filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) {
    return null;
  }
  return { binding, pose };
}

function boundFields(
  binding: GeometryBinding,
  config: GeometryConfig
): { bounds: GeometryTarget["bounds"]; values: GeometryValues } | null {
  const values: GeometryValues = {
    height: 0,
    rotation: 0,
    width: 0,
    x: 0,
    y: 0,
  };
  const bounds: GeometryTarget["bounds"] = {};
  for (const key of GEOMETRY_KEYS) {
    const id = binding[key];
    if (id === null) {
      continue;
    }
    const field = config.fields.find((item) => item.id === id);
    if (!(field && Number.isFinite(field.value))) {
      return null;
    }
    values[key] = field.value;
    bounds[key] = { max: field.max, min: field.min };
  }
  return { bounds, values };
}

function laidOutAt(
  node: HTMLElement,
  rendered: GeometryValues,
  pose: GeometryPose
): boolean {
  const style = getComputedStyle(node);
  const local = similarity(style.transform);
  if (
    style.position !== "absolute" ||
    style.boxSizing !== "border-box" ||
    !close(uniformScale(style.scale), pose.scale) ||
    style.perspective !== "none" ||
    !local ||
    !close(local.scale, 1) ||
    !close(local.rotation, 0) ||
    (style.transform !== "none" && !identityTranslation(style.transform)) ||
    style.visibility !== "visible"
  ) {
    return false;
  }
  if (
    !(
      close(Number.parseFloat(style.left), rendered.x, 0.03) &&
      close(Number.parseFloat(style.top), rendered.y, 0.03) &&
      close(Number.parseFloat(style.width), rendered.width, 0.03) &&
      close(Number.parseFloat(style.height), rendered.height, 0.03) &&
      close(degrees(style.rotate), rendered.rotation)
    )
  ) {
    return false;
  }
  const origin = style.transformOrigin.split(" ").map(Number.parseFloat);
  return (
    close(origin[0], rendered.width / 2, 0.03) &&
    close(origin[1], rendered.height / 2, 0.03)
  );
}

function parentTransform(
  node: HTMLElement
): { parentRotation: number; parentScale: number } | null {
  let parentScale = 1;
  let parentRotation = 0;
  for (
    let parent: HTMLElement | null = parentAcrossRoot(node);
    parent;
    parent = parentAcrossRoot(parent)
  ) {
    const inherited = getComputedStyle(parent);
    if (
      inherited.perspective !== "none" ||
      inherited.visibility !== "visible"
    ) {
      return null;
    }
    const matrix = similarity(inherited.transform);
    const rotation = degrees(inherited.rotate);
    const scale = uniformScale(inherited.scale);
    if (!(matrix && Number.isFinite(rotation) && Number.isFinite(scale))) {
      return null;
    }
    parentScale *= matrix.scale * scale;
    parentRotation += matrix.rotation + rotation;
    const zoom = Number.parseFloat(inherited.zoom);
    if (Number.isFinite(zoom)) {
      parentScale *= inherited.zoom.endsWith("%") ? zoom / 100 : zoom;
    }
  }
  return { parentRotation, parentScale };
}

function boxMatches(
  node: HTMLElement,
  rendered: GeometryValues,
  parentRotation: number,
  scale: number
): boolean {
  const angle = ((rendered.rotation + parentRotation) * Math.PI) / 180;
  const rect = node.getBoundingClientRect();
  const expectedWidth =
    (Math.abs(Math.cos(angle)) * rendered.width +
      Math.abs(Math.sin(angle)) * rendered.height) *
    scale;
  const expectedHeight =
    (Math.abs(Math.sin(angle)) * rendered.width +
      Math.abs(Math.cos(angle)) * rendered.height) *
    scale;
  return (
    close(rect.width, expectedWidth, 0.25) &&
    close(rect.height, expectedHeight, 0.25)
  );
}

function betweenOf(node: HTMLElement): GeometryBetween | null {
  try {
    const parsed = JSON.parse(
      node.getAttribute("data-studio-geometry-between") ?? "null"
    );
    const editing = parsed?.editing;
    const kind = parsed?.kind;
    const other = editing === "from" ? parsed.to : parsed?.from;
    if (
      (editing !== "from" && editing !== "to") ||
      (kind !== "entry" && kind !== "exit") ||
      !GEOMETRY_KEYS.every((key) => Number.isFinite(other?.[key]))
    ) {
      return null;
    }
    const { frames } = parsed;
    return {
      editing,
      frames:
        Number.isFinite(frames?.from) && Number.isFinite(frames?.to)
          ? { from: frames.from, to: frames.to }
          : null,
      kind,
      other: Object.fromEntries(
        GEOMETRY_KEYS.map((key) => [key, other[key]])
      ) as GeometryValues,
    };
  } catch {
    return null;
  }
}

export function renderedGeometry(
  node: HTMLElement,
  values: GeometryValues
): boolean {
  try {
    const rendered = JSON.parse(
      node.getAttribute("data-studio-geometry-values") ?? "null"
    );
    return (
      rendered !== null &&
      GEOMETRY_KEYS.every((key) => close(rendered[key], values[key], 0.000_001))
    );
  } catch {
    return false;
  }
}

function similarity(
  transform: string
): { scale: number; rotation: number } | null {
  if (transform === "none") {
    return { rotation: 0, scale: 1 };
  }
  const matrix = new DOMMatrixReadOnly(transform);
  const scale = Math.hypot(matrix.a, matrix.b);
  if (
    !matrix.is2D ||
    scale <= 0 ||
    !close(matrix.a, matrix.d) ||
    !close(matrix.b, -matrix.c)
  ) {
    return null;
  }
  return { rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI, scale };
}
function identityTranslation(transform: string): boolean {
  const matrix = new DOMMatrixReadOnly(transform);
  return close(matrix.e, 0) && close(matrix.f, 0);
}
function uniformScale(value: string): number {
  if (value === "none") {
    return 1;
  }
  const axes = value.split(" ").map(Number);
  return axes[0] > 0 &&
    axes.length <= 2 &&
    (axes.length === 1 || close(axes[0], axes[1]))
    ? axes[0]
    : Number.NaN;
}
function degrees(value: string): number {
  if (value === "none") {
    return 0;
  }
  if (!DEGREES.test(value)) {
    return Number.NaN;
  }
  return Number.parseFloat(value);
}
function close(a: number, b: number, epsilon = 0.000_001): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
}
