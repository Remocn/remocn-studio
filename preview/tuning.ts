import { assetName, staticBase } from "./assets";
import { allInFibers, hostOf, nearestInFibers } from "./fiber";
import type { StatusKind, TargetStatuses, TuningValue } from "./protocol";

type FieldType =
  | "array"
  | "asset"
  | "boolean"
  | "color"
  | "enum"
  | "font-family"
  | "hidden"
  | "number"
  | "rotation-css"
  | "rotation-degrees"
  | "scale"
  | "text-content"
  | "transform-origin"
  | "translate"
  | "uv-coordinate";

interface SchemaField {
  readonly default?: unknown;
  readonly description?: string;
  // Remotion's own "this belongs in a timeline, not a property list" flag —
  // `from`, `durationInFrames`, `trimBefore` and `freeze` all carry it.
  readonly hiddenFromList?: boolean;
  readonly item?: SchemaField;
  readonly max?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly minLength?: number;
  readonly newItemDefault?: unknown;
  readonly step?: number;
  readonly type: FieldType;
  readonly variants?: Record<string, InteractivitySchema> | readonly string[];
}

export type InteractivitySchema = Readonly<Record<string, SchemaField>>;

export interface TuningField {
  readonly arrayItemType: Exclude<FieldType, "hidden"> | null;
  readonly description: string | null;
  readonly group: string;
  readonly label: string;
  readonly max: number | null;
  readonly maxLength: number | null;
  readonly min: number | null;
  readonly minLength: number | null;
  readonly newItemDefault: TuningValue | null;
  readonly options: readonly string[];
  readonly path: string;
  readonly readOnly: boolean;
  readonly step: number | null;
  // Which `Interactive` in the chain owns this field, since a merged list is
  // edited through as many targets as it was built from.
  readonly targetId: string;
  readonly type: Exclude<FieldType, "hidden">;
  readonly value: TuningValue;
}

export interface TargetWhere {
  readonly column: number | null;
  readonly file: string;
  readonly line: number | null;
}

export interface TuningTarget {
  readonly componentName: string;
  readonly fields: readonly TuningField[];
  /** Remotion's own identity for the component, for the codemod to match on. */
  readonly identity: string | null;
  readonly instanceId: string;
  readonly instances: number;
  /** Every key of the flattened schema, which is what a status is asked for. */
  readonly keys: readonly string[];
  readonly name: string | null;
  readonly ordinal: number;
  /** The JSX call site, from Remotion's own stack. Where a value is written. */
  readonly origin: TargetWhere | null;
  /** The component's `InteractivitySchema`, carried whole for the codemod. */
  readonly schema: unknown;
  readonly targetId: string;
  readonly where: TargetWhere | null;
}

export interface DraftValue {
  readonly frame: number;
  readonly value: TuningValue;
}

/**
 * One live override, as the runtime wants it: a keyframed key carries the
 * status its `interpolate()` was read into, so moving a landing value moves a
 * keyframe rather than replacing the animation with a constant.
 */
export interface OverrideStep {
  readonly frame: number;
  readonly keyframed: unknown | null;
  readonly path: string;
  readonly value: TuningValue;
}

export interface PropStatuses {
  readonly canUpdate: true;
  readonly effects: readonly never[];
  readonly props: Readonly<Record<string, unknown>>;
}

export interface PublishPlan {
  readonly overrides: readonly OverrideStep[];
  readonly statuses: PropStatuses;
}

const EMPTY_STATUSES: PropStatuses = {
  canUpdate: true,
  effects: [],
  props: {},
};

export function emptyPlan(): PublishPlan {
  return { overrides: [], statuses: EMPTY_STATUSES };
}

function staticStatus(value: TuningValue) {
  return {
    codeValue: value,
    keyframeDisplayOffsetAdjustment: null,
    status: "static",
  };
}

/**
 * What the runtime is told about one element: every status the codemod read,
 * plus one override per value the pane is holding.
 *
 * Two keys are handed a synthetic `static` status instead of the real one. A
 * key the code *computes* has no status the runtime would merge an override
 * into — `computeEffectiveSchemaValuesDotNotation` takes the incoming prop and
 * drops the override on the floor — so a value the person is composing a
 * request about would not show on the frame at all. And when the codemod could
 * not read the file at all (a Remotion older than 4.0.513, a source location
 * nothing resolved), every drafted key falls back the same way: the pane keeps
 * working everywhere, and only writing is lost.
 */
export function publishPlan(
  draft: Readonly<Record<string, DraftValue>>,
  statuses: TargetStatuses | null
): PublishPlan {
  const drafted = Object.entries(draft);

  if (drafted.length === 0 && statuses === null) {
    return emptyPlan();
  }

  const props: Record<string, unknown> = {};

  for (const [path, status] of Object.entries(
    statuses === null ? {} : statuses.props
  )) {
    props[path] = status.status;
  }

  const overrides = drafted.map(([path, held]) => {
    const known = statuses?.props[path] ?? null;

    if (known === null || known.kind === "computed") {
      props[path] = staticStatus(held.value);
      return { frame: held.frame, keyframed: null, path, value: held.value };
    }

    return {
      frame: held.frame,
      keyframed: known.kind === "keyframed" ? known.status : null,
      path,
      value: held.value,
    };
  });

  return { overrides, statuses: { canUpdate: true, effects: [], props } };
}

export function kindOf(
  statuses: TargetStatuses | null,
  path: string
): StatusKind | null {
  return statuses?.props[path]?.kind ?? null;
}

export interface InteractiveControls {
  readonly componentIdentity?: string | null;
  readonly componentName: string;
  readonly currentRuntimeValueDotNotation: Readonly<Record<string, unknown>>;
  readonly overrideId: string;
  readonly schema: InteractivitySchema;
}

export function asControls(value: unknown): InteractiveControls | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<InteractiveControls>;

  return typeof candidate.overrideId === "string" &&
    candidate.overrideId.length > 0 &&
    typeof candidate.componentName === "string" &&
    typeof candidate.schema === "object" &&
    candidate.schema !== null
    ? (candidate as InteractiveControls)
    : null;
}

/**
 * The controls of the innermost `Interactive` around an element, read off the
 * React tree rather than off `refForOutline`.
 *
 * This is the primary lookup because Remotion resolves a `<Sequence
 * layout="none">`'s outline ref to **null** unless the component passed
 * `outlineRef` itself — so a component that declares a schema, passes its
 * `controls` and animates correctly is still invisible to a DOM-containment
 * search. `controls` is a prop, and a prop is on the fiber whatever the author
 * remembered to wire.
 */
export function controlsAt(element: Element): InteractiveControls | null {
  return nearestInFibers(element, (fiber) =>
    asControls(fiber.memoizedProps?.controls)
  );
}

export interface InteractiveLink {
  readonly controls: InteractiveControls;
  /** Where this `Interactive` is on screen, for the pane to point back at. */
  readonly node: Element | null;
}

/**
 * Every `Interactive` around an element, innermost first.
 *
 * There is always more than one in agent-written markup, because the studio's
 * own conventions ask for both: `Interactive.Div` and its siblings for the
 * markup, so the styles are editable, and `Interactive.withSchema` around the
 * component, so its own parameters are. Only the chain sees both — the nearest
 * alone is Remotion's element primitive, and the component's parameters sit
 * one level out where nothing can ever point at them.
 */
export function controlsChain(element: Element): InteractiveLink[] {
  const seen = new Set<string>();

  return allInFibers(element, (fiber) => {
    const controls = asControls(fiber.memoizedProps?.controls);

    if (controls === null || seen.has(controls.overrideId)) {
      return null;
    }

    seen.add(controls.overrideId);
    return { controls, node: hostOf(fiber) };
  });
}

export interface OutlinedSequence {
  readonly controls: unknown;
  readonly refForOutline: { readonly current: Element | null } | null;
}

export function nearestInteractive<T extends OutlinedSequence>(
  sequences: readonly T[],
  element: Element
): T | null {
  const candidates = sequences.filter((sequence) => {
    const node = sequence.refForOutline?.current;
    return sequence.controls !== null && node?.contains(element) === true;
  });

  let nearest: T | null = null;
  for (const candidate of candidates) {
    const current = nearest?.refForOutline?.current ?? null;
    const candidateNode = candidate.refForOutline?.current ?? null;
    if (
      current === null ||
      candidateNode === null ||
      current.contains(candidateNode)
    ) {
      nearest = candidate;
    }
  }

  return nearest;
}

export interface RegistryEntry {
  readonly anchor: string;
  readonly componentName: string;
  readonly key: string;
  readonly live: readonly string[];
}

export interface RegistryControls {
  readonly componentName: string;
  readonly overrideId: string;
}

export interface RegistrySequence {
  readonly controls: RegistryControls | null;
  readonly refForOutline: { readonly current: Element | null } | null;
}

export interface Rebound {
  readonly key: string;
  readonly live: readonly string[];
  readonly node: Element | null;
}

export function rebind(
  entries: readonly RegistryEntry[],
  sequences: readonly RegistrySequence[],
  resolve: (anchor: string) => Element | null,
  chainOf: (node: Element) => readonly RegistryControls[] = registeredChain
): Rebound[] {
  return entries.map((entry) => {
    const node = resolve(entry.anchor);

    if (node === null) {
      return { key: entry.key, live: [], node: null };
    }

    const named = sequences.filter(
      (sequence) => sequence.controls?.componentName === entry.componentName
    );
    const anchored = named.filter((sequence) => {
      const outline = sequence.refForOutline?.current ?? null;

      return outline !== null && (outline === node || outline.contains(node));
    });

    if (anchored.length > 0) {
      return { key: entry.key, live: deepestFirst(anchored), node };
    }

    return {
      key: entry.key,
      live: unique(
        chainOf(node)
          .filter((controls) => controls.componentName === entry.componentName)
          .map((controls) => controls.overrideId)
      ),
      node,
    };
  });
}

export function sameMappings<T>(
  was: Readonly<Record<string, T>>,
  now: Readonly<Record<string, T>>
): boolean {
  const keys = Object.keys(was);

  return (
    keys.length === Object.keys(now).length &&
    keys.every((key) => was[key] === now[key])
  );
}

function registeredChain(node: Element): readonly RegistryControls[] {
  return controlsChain(node).map((link) => link.controls);
}

function deepestFirst(sequences: readonly RegistrySequence[]): string[] {
  const ordered = [...sequences].sort((first, second) => {
    const one = first.refForOutline?.current ?? null;
    const other = second.refForOutline?.current ?? null;

    if (one === null || other === null || one === other) {
      return 0;
    }

    if (other.contains(one)) {
      return -1;
    }

    return one.contains(other) ? 1 : 0;
  });

  return unique(
    ordered.flatMap((sequence) =>
      sequence.controls === null ? [] : [sequence.controls.overrideId]
    )
  );
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

const SUPPORTED = new Set<Exclude<FieldType, "hidden">>([
  "array",
  "asset",
  "boolean",
  "color",
  "enum",
  "font-family",
  "number",
  "rotation-css",
  "rotation-degrees",
  "scale",
  "text-content",
  "transform-origin",
  "translate",
  "uv-coordinate",
]);

const TRANSFORMS = new Set([
  "style.rotate",
  "style.scale",
  "style.transformOrigin",
  "style.translate",
]);

const LAYER = new Set(["hidden", "style.mixBlendMode", "style.opacity"]);

const TYPOGRAPHY =
  /^style\.(color|font|letterSpacing|lineHeight|text|whiteSpace)/;
const BARE_TYPOGRAPHY =
  /^(color|fontFamily|fontSize|fontStyle|fontWeight|letterSpacing|lineHeight|textAlign)$/;
const FILL = /(^fill|background|^style\.background)/i;
const STROKE = /(^stroke|border(?!Radius)|outline)/i;
const TIMING = /(^from$|durationInFrames|premountFor|postmountFor|frame)/i;
const ENTRY = /^(transitionIn\.|entry([A-Z.]|$))/;
const EXIT = /^(transitionOut\.|exit([A-Z.]|$))/;
const EFFECTS = /^effects?([A-Z.]|$)/;
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const FIRST_CHARACTER = /^./;
const UNIT = /^-?\d+(\.\d+)?[a-z%]+$/i;
const NUMERIC = new Set<FieldType>(["number", "rotation-degrees"]);
const TEXT_PATH = "children";
const SPLIT_TEXT = "Text is built from parts — ask in words";
const IN_CODE = "value in code";

export function describeTuning({
  componentName,
  identity = null,
  instanceId = "",
  instances = 1,
  ordinal = 1,
  origin = null,
  schema,
  targetId,
  values,
}: {
  readonly componentName: string;
  readonly identity?: string | null;
  readonly instanceId?: string;
  readonly instances?: number;
  readonly ordinal?: number;
  readonly origin?: TargetWhere | null;
  readonly schema: InteractivitySchema;
  readonly targetId: string;
  readonly values: Readonly<Record<string, unknown>>;
}): TuningTarget | null {
  const active = flattenActiveSchema(schema, values);
  const fields = textFirst(
    Object.entries(active)
      .map(([path, field]) => descriptorOf(path, field, values[path], targetId))
      .filter((field): field is TuningField => field !== null)
  );

  return fields.length === 0
    ? null
    : {
        componentName,
        fields,
        identity,
        instanceId,
        instances,
        keys: Object.keys(active),
        name: nameIn(values),
        ordinal,
        origin,
        schema,
        targetId,
        where: null,
      };
}

function isTextField(field: TuningField): boolean {
  return field.path === TEXT_PATH && field.type === "text-content";
}

function textFirst(fields: readonly TuningField[]): TuningField[] {
  const lead = fields.filter(isTextField);

  return lead.length === 0
    ? [...fields]
    : [...lead, ...fields.filter((field) => !isTextField(field))];
}

export function nameIn(
  values: Readonly<Record<string, unknown>>
): string | null {
  const { name } = values;

  return typeof name === "string" && name.length > 0 ? name : null;
}

const PRIMITIVE_NAME = /^<Interactive\.(.+)>$/;

export function plainName(componentName: string): string {
  return PRIMITIVE_NAME.exec(componentName)?.[1] ?? componentName;
}

const PLUMBING = new Set(["hidden", "layout"]);

export function isPlumbing(target: TuningTarget): boolean {
  return (
    target.fields.length > 0 &&
    target.fields.every((field) => PLUMBING.has(field.path))
  );
}

export function fieldAt(
  schema: InteractivitySchema,
  values: Readonly<Record<string, unknown>>,
  path: string
): SchemaField | null {
  return flattenActiveSchema(schema, values)[path] ?? null;
}

export function isFieldValue(
  field: SchemaField,
  value: unknown
): value is TuningValue {
  if (!isTuningValue(value)) {
    return false;
  }

  if (field.type === "array") {
    return (
      Array.isArray(value) &&
      (field.minLength === undefined || value.length >= field.minLength) &&
      (field.maxLength === undefined || value.length <= field.maxLength) &&
      field.item !== undefined &&
      value.every((entry) => isFieldValue(field.item as SchemaField, entry))
    );
  }

  if (field.type === "boolean") {
    return typeof value === "boolean";
  }

  if (field.type === "number" || field.type === "rotation-degrees") {
    return isBoundedNumber(field, value);
  }

  if (field.type === "uv-coordinate") {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((entry) => isBoundedNumber(field, entry))
    );
  }

  if (field.type === "scale") {
    return typeof value === "string" || isBoundedNumber(field, value);
  }

  if (field.type === "enum") {
    if (typeof value !== "string" || field.variants === undefined) {
      return false;
    }

    return Array.isArray(field.variants)
      ? field.variants.includes(value)
      : value in field.variants;
  }

  return typeof value === "string";
}

export function isTuningValue(value: unknown): value is TuningValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry === null ||
        typeof entry === "boolean" ||
        typeof entry === "string" ||
        (typeof entry === "number" && Number.isFinite(entry))
    )
  );
}

function isOptionList(
  variants: NonNullable<SchemaField["variants"]>
): variants is readonly string[] {
  return Array.isArray(variants);
}

function flattenActiveSchema(
  schema: InteractivitySchema,
  values: Readonly<Record<string, unknown>>
): InteractivitySchema {
  const out: Record<string, SchemaField> = {};

  for (const [path, field] of Object.entries(schema)) {
    if (field.type === "hidden") {
      continue;
    }

    out[path] = field;

    const { variants } = field;
    if (
      field.type !== "enum" ||
      variants === undefined ||
      isOptionList(variants)
    ) {
      continue;
    }

    const selected = defaultedValue(field, values[path]);
    const variant =
      typeof selected === "string" ? variants[selected] : undefined;

    if (variant !== undefined && !Array.isArray(variant)) {
      Object.assign(out, flattenActiveSchema(variant, values));
    }
  }

  return out;
}

function descriptorOf(
  path: string,
  field: SchemaField,
  current: unknown,
  targetId: string
): TuningField | null {
  if (
    field.type === "hidden" ||
    field.hiddenFromList === true ||
    !SUPPORTED.has(field.type)
  ) {
    return null;
  }

  const read = readingOf(field, defaultedValue(field, current));
  if (read === null) {
    return null;
  }

  return {
    arrayItemType:
      read.type === "array" &&
      field.item !== undefined &&
      field.item.type !== "hidden" &&
      SUPPORTED.has(field.item.type)
        ? field.item.type
        : null,
    description: read.description,
    group: groupOf(path, read.type),
    label: labelFor(field.description, path),
    max: finiteOrNull(field.max),
    maxLength: integerOrNull(field.maxLength),
    min: finiteOrNull(field.min),
    minLength: integerOrNull(field.minLength),
    newItemDefault:
      read.type === "array" && isTuningValue(field.newItemDefault)
        ? field.newItemDefault
        : null,
    options: optionsOf(field),
    path,
    readOnly: read.readOnly,
    step: finiteOrNull(field.step),
    targetId,
    type: read.type,
    value: read.value,
  };
}

interface FieldReading {
  readonly description: string | null;
  readonly readOnly: boolean;
  readonly type: Exclude<FieldType, "hidden">;
  readonly value: TuningValue;
}

function readingOf(field: SchemaField, value: unknown): FieldReading | null {
  if (field.type === "hidden" || !SUPPORTED.has(field.type)) {
    return null;
  }

  const described = field.description ?? null;

  // An asset's value is the URL `staticFile()` produced; the pane holds the
  // name behind it, which is the only half of that URL worth carrying.
  if (field.type === "asset" && typeof value === "string") {
    return {
      description: described,
      readOnly: false,
      type: "asset",
      value: assetName(value, staticBase()),
    };
  }

  if (isFieldValue(field, value)) {
    return {
      description: described,
      readOnly: false,
      type: field.type,
      value,
    };
  }

  if (
    field.type === "enum" &&
    typeof value === "number" &&
    optionsOf(field).includes(String(value))
  ) {
    return {
      description: described,
      readOnly: false,
      type: "enum",
      value: String(value),
    };
  }

  if (field.type === "text-content") {
    return {
      description: SPLIT_TEXT,
      readOnly: true,
      type: "text-content",
      value: "",
    };
  }

  if (
    NUMERIC.has(field.type) &&
    typeof value === "string" &&
    UNIT.test(value)
  ) {
    return {
      description: described,
      readOnly: true,
      type: "text-content",
      value,
    };
  }

  if (value === undefined) {
    return null;
  }

  return {
    description: IN_CODE,
    readOnly: true,
    type: "text-content",
    value: printed(value),
  };
}

function printed(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function defaultedValue(field: SchemaField, current: unknown): unknown {
  if (field.type === "text-content") {
    return current;
  }

  return current === undefined ? field.default : current;
}

function optionsOf(field: SchemaField): readonly string[] {
  if (field.type === "enum" && field.variants !== undefined) {
    return Array.isArray(field.variants)
      ? field.variants
      : Object.keys(field.variants);
  }

  if (field.type === "array" && field.item?.type === "enum") {
    return optionsOf(field.item);
  }

  return [];
}

function groupOf(path: string, type: FieldType): string {
  if (type === "text-content" && path === TEXT_PATH) {
    return "Typography";
  }

  if (TRANSFORMS.has(path)) {
    return "Transform";
  }

  if (LAYER.has(path)) {
    return "Layer";
  }

  if (TYPOGRAPHY.test(path) || BARE_TYPOGRAPHY.test(path)) {
    return "Typography";
  }

  // The picture an element is made of is what it is painted with — and
  // `src` matches none of the Fill patterns, which are about colour.
  if (type === "asset") {
    return "Fill";
  }

  if (ENTRY.test(path)) {
    return "Entry";
  }

  if (EXIT.test(path)) {
    return "Exit";
  }

  if (EFFECTS.test(path)) {
    return "Effects";
  }

  if (FILL.test(path)) {
    return "Fill";
  }

  if (STROKE.test(path)) {
    return "Stroke";
  }

  return TIMING.test(path) ? "Timing" : "Parameters";
}

// A label is one clipped line beside its value, and a description is prose
// under the row. Remotion's own built-ins describe themselves in two words
// ("Font size", "Opacity") and read better than the path would, so a short
// description is taken as the label — but a schema written by an agent says
// things like "Frames per drift cycle — kept coprime with the ambient
// periods", and that is not a label whatever the pane does with it.
const LABEL_LIMIT = 24;

export function labelFor(
  description: string | undefined,
  path: string
): string {
  return description !== undefined &&
    description.length > 0 &&
    description.length <= LABEL_LIMIT
    ? description
    : labelOf(path);
}

// Sentence case, because Remotion's own descriptions are ("Font size",
// "Transform origin") and the two sit in one column: Title Case beside them
// would read as two products.
function labelOf(path: string): string {
  const last = path.split(".").at(-1) ?? path;
  return last
    .replace(CAMEL_BOUNDARY, "$1 $2")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(FIRST_CHARACTER, (letter) => letter.toUpperCase());
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isBoundedNumber(field: SchemaField, value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (field.min === undefined || value >= field.min) &&
    (field.max === undefined || value <= field.max)
  );
}
