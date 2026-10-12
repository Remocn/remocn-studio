// biome-ignore-all lint/performance/noJsxPropsBind: Every control needs its own path and current value.
// biome-ignore-all lint/suspicious/noArrayIndexKey: Arrays are ordered and do not support reordering.
"use client";

import {
  ColorControl as DialColorControl,
  EasingVisualization as DialEasingVisualization,
  ImageControl as DialImageControl,
  DialPad,
  SelectControl as DialSelectControl,
  Slider as DialSlider,
  TextControl as DialTextControl,
  Toggle as DialToggle,
} from "dialkit";
import { useCallback, useId } from "react";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import { useScrubEdit } from "@/hooks/use-scrub-edit";
import {
  axisSliderOf,
  type DialSliderSpec,
  padAxesFrom,
  padOf,
  sliderOf,
  valueFromSlider,
} from "@/lib/studio/dialkit";
import {
  BEZIER_PRESETS,
  bezierOfValue,
  cssBezier,
  type EasingKind,
  easingKindOf,
  matchPresetLabel,
  presetByLabel,
} from "@/lib/studio/easing";
import type { TuningField } from "@/lib/studio/preview";
import { assetName, assetOptions, assetUrl } from "@/lib/studio/static-files";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import {
  type Composite,
  compositeOf,
  fractionOf,
  fromPercent,
  isPercent,
  toPercent,
  withAxes,
  withAxis,
} from "@/lib/studio/tuning";
import { cn } from "@/lib/utils";
import type { TuningValue } from "@/shared/ipc";

export type Change = (path: string, value: TuningValue) => void;

/** The project's own pictures, and where the app can load them from. */
export interface AssetOptions {
  readonly base: string | null;
  readonly names: readonly string[];
}

const ROW =
  "grid min-h-7.5 grid-cols-[minmax(2.5rem,30%)_minmax(0,1fr)_1.25rem] items-center gap-x-2";
const LABEL = "truncate text-muted-foreground text-xs";
// Keep keyboard focus consistent with the flat Inspector controls.
const FOCUS =
  "focus-within:outline-2 focus-within:outline-solid focus-within:outline-ring focus-within:outline-offset-1";
const FIELD = `flex h-7.5 w-full flex-row items-center gap-1.5 overflow-hidden rounded-md control-surface px-2 text-xs ${FOCUS}`;
const VALUE =
  "min-w-0 flex-1 truncate bg-transparent text-left text-foreground text-xs outline-none";
// The letter inside a field is its drag handle, and dragging it is the whole
// point — so it never looks like inert decoration.
const HANDLE =
  "shrink-0 cursor-ew-resize select-none text-2xs text-muted-foreground";
const NUMERIC = new Set(["number", "rotation-degrees", "scale"]);

export function TuningRow({
  animated,
  assets,
  duration,
  field,
  fonts,
  onChange,
  onReset,
  original,
  refusal,
}: {
  animated?: boolean;
  assets?: AssetOptions;
  duration: number;
  field: TuningField;
  fonts?: readonly string[];
  onChange: Change;
  onReset: (paths: readonly string[]) => void;
  original: TuningValue | undefined;
  refusal: string | null;
}) {
  const changed =
    field.readOnly !== true &&
    original !== undefined &&
    JSON.stringify(original) !== JSON.stringify(field.value);

  return (
    <div className="group/row">
      <FieldControl
        action={
          changed ? (
            <Button
              aria-label={`Reset ${field.label}`}
              className="relative size-5 text-muted-foreground opacity-0 pointer-coarse:opacity-100 transition-opacity after:absolute after:-inset-2 focus-visible:opacity-100 group-hover/row:opacity-100"
              onClick={() => onReset([field.path])}
              size="icon-xs"
              variant="ghost"
            >
              <RotateCcwIcon />
            </Button>
          ) : (
            <span />
          )
        }
        assets={assets}
        duration={duration}
        field={field}
        fonts={fonts}
        onChange={onChange}
        original={original}
      />

      {refusal === null ? null : (
        <p className="px-3 pt-1 text-destructive text-xs" role="alert">
          {refusal}
        </p>
      )}

      {animated === true ? (
        <p className="flex items-center gap-1.5 px-3 pt-1 text-2xs text-muted-foreground">
          <span className="shrink-0 rounded-sm bg-muted px-1 py-px font-medium text-2xs">
            Animated
          </span>
          a change here moves the value at this frame; the animation keeps
          running
        </p>
      ) : null}

      {/* The sentence a schema wrote lives here, under the control, where it
          has the pane's whole width to wrap in — it is prose, not a label. */}
      {field.description === null ||
      field.description === field.label ? null : (
        <p className="px-3 pt-1 text-2xs text-muted-foreground">
          {field.description}
        </p>
      )}
    </div>
  );
}

function FieldControl({
  action,
  assets,
  duration,
  field,
  fonts,
  onChange,
  original,
}: {
  action: React.ReactNode;
  assets?: AssetOptions;
  duration: number;
  field: TuningField;
  fonts?: readonly string[];
  onChange: Change;
  original: TuningValue | undefined;
}) {
  if (field.readOnly === true) {
    return <ReadOnlyControl action={action} field={field} />;
  }

  if (field.type === "asset") {
    return (
      <AssetControl
        action={action}
        assets={assets ?? { base: null, names: [] }}
        field={field}
        onChange={onChange}
      />
    );
  }

  if (field.type === "text-content") {
    return (
      <TextContentControl action={action} field={field} onChange={onChange} />
    );
  }

  if (field.type === "font-family") {
    return (
      <FontFamilyControl
        action={action}
        field={field}
        fonts={fonts ?? []}
        onChange={onChange}
      />
    );
  }

  const composite = compositeOf(field);

  if (composite !== null) {
    const originalComposite = compositeOf({
      ...field,
      value: original ?? field.value,
    });

    return (
      <AxesControl
        action={action}
        composite={composite}
        field={field}
        onChange={onChange}
        original={originalComposite ?? composite}
      />
    );
  }

  const easing = easingKindOf(field);

  if (easing !== null) {
    return (
      <EasingControl
        action={action}
        duration={duration}
        field={field}
        kind={easing}
        onChange={onChange}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <DialControl action={action} title={field.label}>
        <DialToggle
          checked={field.value === true}
          label={field.label}
          onChange={(checked) => onChange(field.path, checked)}
        />
      </DialControl>
    );
  }

  if (field.type === "enum") {
    return (
      <DialControl action={action} title={field.label}>
        <DialSelectControl
          label={field.label}
          onChange={(value) => onChange(field.path, value)}
          options={[...field.options]}
          value={String(field.value)}
        />
      </DialControl>
    );
  }

  if (field.type === "color") {
    return (
      <DialControl action={action} title={field.label}>
        <DialColorControl
          label={field.label}
          onChange={(value) => onChange(field.path, value)}
          value={String(field.value)}
        />
      </DialControl>
    );
  }

  if (field.type === "array") {
    return (
      <ArrayControl
        action={action}
        field={field}
        onChange={onChange}
        original={original}
      />
    );
  }

  if (NUMERIC.has(field.type) && typeof field.value === "number") {
    const slider = sliderOf(field, original);

    if (slider !== null) {
      return (
        <DialControl action={action} title={field.label}>
          <DialSlider
            label={field.label}
            max={slider.max}
            min={slider.min}
            onChange={(value) =>
              onChange(field.path, valueFromSlider(field, value))
            }
            step={slider.step}
            unit={slider.unit}
            value={slider.value}
          />
        </DialControl>
      );
    }

    return <NumberControl action={action} field={field} onChange={onChange} />;
  }

  return (
    <DialControl action={action} title={field.label}>
      <DialTextControl
        label={field.label}
        onChange={(value) => onChange(field.path, value)}
        value={String(field.value)}
      />
    </DialControl>
  );
}

/**
 * The picture an element is made of, chosen from what the project already has.
 *
 * The options are the images in its own `public/`, which is the value space
 * `staticFile()` names and the only one both the preview can serve and the
 * agent can write. dialkit's own upload is hidden in `app/globals.css`: it
 * hands back a data URL, there is no seam to redirect it to a file, and a data
 * URL in somebody's TSX is exactly what a picker must not produce. A picture
 * the project does not have yet arrives the way every other one does — dragged
 * into the composer, or picked out of the library as `[Asset #N]`.
 */
function AssetControl({
  action,
  assets,
  field,
  onChange,
}: {
  action: React.ReactNode;
  assets: AssetOptions;
  field: TuningField;
  onChange: Change;
}) {
  const name = String(field.value);

  return (
    <DialControl action={action} title={field.label}>
      <DialImageControl
        label={field.label}
        onChange={(url) => onChange(field.path, assetName(url, assets.base))}
        options={assetOptions(assets.names, assets.base)}
        value={assetUrl(name, assets.base)}
      />
    </DialControl>
  );
}

function ReadOnlyControl({
  action,
  field,
}: {
  action: React.ReactNode;
  field: TuningField;
}) {
  return (
    <div className={ROW}>
      <span className={LABEL} title={field.label}>
        {field.label}
      </span>
      <span className={cn(FIELD, "text-muted-foreground")}>
        <span className={cn(VALUE, "cursor-default")}>
          {String(field.value)}
        </span>
      </span>
      {action}
    </div>
  );
}

function TextContentControl({
  action,
  field,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
}) {
  const write = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(
        event.currentTarget.dataset.path ?? "",
        event.currentTarget.value
      );
    },
    [onChange]
  );

  return (
    <DialControl action={action}>
      <div className="dialkit-composite-control">
        <span className="dialkit-composite-label" title={field.label}>
          {field.label}
        </span>
        <Textarea
          {...VERBATIM_INPUT}
          aria-label={field.label}
          className="max-h-24 min-h-14 resize-none text-xs"
          data-path={field.path}
          onChange={write}
          rows={2}
          value={String(field.value)}
        />
      </div>
    </DialControl>
  );
}

function FontFamilyControl({
  action,
  field,
  fonts,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  fonts: readonly string[];
  onChange: Change;
}) {
  const listId = useId();
  const write = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(
        event.currentTarget.dataset.path ?? "",
        event.currentTarget.value
      );
    },
    [onChange]
  );

  return (
    <div className={ROW}>
      <span className={LABEL} title={field.label}>
        {field.label}
      </span>
      <span className={FIELD}>
        <input
          aria-label={field.label}
          className={VALUE}
          data-path={field.path}
          list={listId}
          onChange={write}
          type="text"
          value={String(field.value)}
        />
        <datalist id={listId}>
          {fonts.map((family) => (
            <option key={family} value={family} />
          ))}
        </datalist>
      </span>
      {action}
    </div>
  );
}

function DialControl({
  action,
  align,
  children,
  title,
}: {
  action: React.ReactNode;
  /** Where the reset sits: centred on the control, or on its first row. A pad
      is a square and centring on it puts the button in the middle of nothing. */
  align?: "top";
  children: React.ReactNode;
  /** The label whole, since the one on screen is clipped to a single line. */
  title?: string;
}) {
  return (
    <div
      className="dialkit-control-with-action"
      data-align={align}
      title={title}
    >
      {children}
      <span className="dialkit-control-action">{action}</span>
    </div>
  );
}

/**
 * The workhorse: one field, three gestures. The whole surface is the scrub
 * area — drag anywhere to change the value, and a click that never moved
 * drops into typing (Base UI focuses the input and re-dispatches the click
 * that pointer lock swallowed). Arrows step, shift by ten, alt finely. A
 * bounded value paints how far along it is as a fill behind the number.
 */
export function Scrubber({
  ariaLabel,
  format,
  onEditEnd,
  fill,
  handle,
  max,
  min,
  onCommit,
  step,
  value,
}: {
  ariaLabel: string;
  format?: Intl.NumberFormatOptions;
  onEditEnd?: () => void;
  fill?: number;
  handle: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const grain = step ?? 1;
  const scrub = useScrubEdit();

  return (
    <NumberField
      className={cn(FIELD, "relative w-full")}
      format={format}
      largeStep={grain * 10}
      max={max}
      min={min}
      onValueChange={(next) => {
        if (next !== null && Number.isFinite(next)) {
          onCommit(next);
        }
      }}
      onValueCommitted={onEditEnd}
      smallStep={grain / 10}
      step={grain}
      value={value}
    >
      {fill === undefined ? null : (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-foreground/10"
          data-fill
          style={{ width: `${fill * 100}%` }}
        />
      )}
      {/* The in-flow twin of the overlay's glyph, so the value starts where
          the glyph ends whatever character the glyph is. */}
      <span aria-hidden className="invisible shrink-0 text-2xs">
        {handle}
      </span>
      <NumberFieldInput
        aria-label={ariaLabel}
        className={cn(
          VALUE,
          "relative h-auto rounded-none p-0 tabular-nums leading-none sm:h-auto sm:leading-none"
        )}
        onBlur={scrub.done}
        ref={scrub.ref}
      />
      <NumberFieldScrubArea
        className={cn(
          HANDLE,
          "absolute inset-0 flex items-center px-2",
          "[&>[data-slot=label]]:cursor-ew-resize [&>[data-slot=label]]:font-normal [&>[data-slot=label]]:text-2xs [&>[data-slot=label]]:text-inherit",
          scrub.editing && "pointer-events-none"
        )}
        label={handle}
        onClick={scrub.edit}
      />
    </NumberField>
  );
}

// Two numbers wearing one value: `"0px 12px"`, `"50% 50%"`, `[0.5, 0.5]`.
// Each axis gets its own field, side by side, exactly as a design tool sets
// X and Y.
function AxesControl({
  action,
  composite,
  field,
  onChange,
  original,
}: {
  action: React.ReactNode;
  composite: Composite;
  field: TuningField;
  onChange: Change;
  original: Composite;
}) {
  const pad = padOf(field, composite, original);

  if (pad !== null) {
    return (
      <DialControl action={action} align="top" title={field.label}>
        <DialPad
          label={field.label}
          labels={pad.labels}
          onChange={(point) =>
            onChange(field.path, withAxes(composite, padAxesFrom(pad, point)))
          }
          value={pad.value}
          x={[...pad.x]}
          y={[...pad.y]}
        />
      </DialControl>
    );
  }

  const sliders = composite.axes.map((axis, index) =>
    axisSliderOf(
      field,
      axis.value,
      original.axes[index]?.value ?? axis.value,
      axis.unit
    )
  );

  if (sliders.every((slider) => slider !== null)) {
    return (
      <DialControl action={action}>
        <div className="dialkit-composite-control">
          <span className="dialkit-composite-label">{field.label}</span>
          {/* dialkit's slider draws its own label and names itself after it,
              so a pair sharing 340px reads "X" and "Y" on screen and takes
              the field's name from the group around them. */}
          {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is
              min-content wide by default, which is exactly what a two-column
              grid at half a 340px pane cannot afford. */}
          <div
            aria-label={field.label}
            className="dialkit-composite-axes"
            role="group"
          >
            {composite.axes.map((axis, index) => {
              const spec = sliders[index] as DialSliderSpec;

              return (
                <DialSlider
                  key={axis.label}
                  label={axis.label}
                  max={spec.max}
                  min={spec.min}
                  onChange={(next) =>
                    onChange(field.path, withAxis(composite, index, next))
                  }
                  step={spec.step}
                  unit={spec.unit}
                  value={spec.value}
                />
              );
            })}
          </div>
        </div>
      </DialControl>
    );
  }

  return (
    <div className={ROW}>
      <span className={LABEL}>{field.label}</span>
      <span
        className={cn(
          "grid min-w-0 gap-1",
          composite.axes.length > 1 ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {composite.axes.map((axis, index) => (
          <Scrubber
            ariaLabel={`${field.label} ${axis.label}`}
            fill={fractionOf(axis.value, field.min, field.max)}
            handle={axis.label}
            key={axis.label}
            max={field.max ?? undefined}
            min={field.min ?? undefined}
            onCommit={(next) =>
              onChange(field.path, withAxis(composite, index, next))
            }
            step={field.step ?? undefined}
            value={axis.value}
          />
        ))}
      </span>
      {action}
    </div>
  );
}

function NumberControl({
  action,
  field,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
}) {
  const percent = isPercent(field);
  const raw = typeof field.value === "number" ? field.value : 0;

  return (
    <div className={ROW}>
      <span className={LABEL}>{field.label}</span>
      <Scrubber
        ariaLabel={field.label}
        fill={fractionOf(raw, field.min, field.max)}
        handle={percent ? "%" : "#"}
        max={percent ? 100 : (field.max ?? undefined)}
        min={percent ? 0 : (field.min ?? undefined)}
        onCommit={(next) =>
          onChange(field.path, percent ? fromPercent(next) : next)
        }
        step={percent ? 1 : (field.step ?? undefined)}
        value={percent ? toPercent(raw) : raw}
      />
      {action}
    </div>
  );
}

const HANDLE_MIN_Y = -1;
const HANDLE_MAX_Y = 2;

const BEZIER_AXES: readonly { at: 0 | 1 | 2 | 3; label: string }[] = [
  { at: 0, label: "x1" },
  { at: 1, label: "y1" },
  { at: 2, label: "x2" },
  { at: 3, label: "y2" },
];

/**
 * An interpolation editor over the value the component actually holds: an
 * enum of easing names gets a curve it can read and a preset it can pick,
 * a four-number bezier additionally gets draggable handles and its numbers.
 * A spring is not this — it is ordinary damping/stiffness props, which the
 * panel already shows as numbers.
 */
function EasingControl({
  action,
  duration,
  field,
  kind,
  onChange,
}: {
  action: React.ReactNode;
  duration: number;
  field: TuningField;
  kind: EasingKind;
  onChange: Change;
}) {
  const bezier = bezierOfValue(field.value);
  // Handles are drawn only where they can be dragged: an enum holds one of its
  // own names and nothing else, so dialkit is handed no `onChange` and draws
  // its two handles disabled.
  const editable = kind === "bezier" && bezier !== null;

  // A stack, not a row. Every other control here is a dialkit pill with its
  // label inside it; this one is a canvas, a picker and four numbers, and
  // forcing it into the row grid reserved a label column the pill rows do not
  // have — so the whole block sat in a narrower second column and the pane
  // read as two competing alignments. It shares `dialkit-composite-control`
  // with the X/Y pairs, which had already settled this: label on its own line,
  // everything under it at the pane's own edge.
  return (
    <DialControl action={action}>
      <div className="dialkit-composite-control">
        <span className="dialkit-composite-label" title={field.label}>
          {field.label}
        </span>

        {bezier === null ? null : (
          <DialEasingVisualization
            easing={{ duration, ease: [...bezier], type: "easing" }}
            onChange={
              editable ? (ease) => onChange(field.path, [...ease]) : undefined
            }
          />
        )}

        {kind === "enum" ? (
          <DialSelectControl
            label="Curve"
            onChange={(option) => onChange(field.path, option)}
            options={[...field.options]}
            value={String(field.value)}
          />
        ) : (
          <DialSelectControl
            label="Preset"
            onChange={(option) => {
              const preset = presetByLabel(option);
              if (preset !== null) {
                onChange(field.path, [...preset]);
              }
            }}
            options={BEZIER_PRESETS.map((preset) => ({
              label: preset.label,
              value: preset.label,
            }))}
            value={
              (bezier === null ? null : matchPresetLabel(bezier)) ?? "Custom"
            }
          />
        )}

        {/* The dot runs the element's own window, so the curve is judged at
            the speed it will really play. dialkit's `EasingConfig` carries the
            same number and — measured in 2.0 — draws nothing from it. */}
        {bezier === null ? null : (
          <div className="relative h-3">
            <span
              className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground motion-reduce:hidden"
              key={cssBezier(bezier)}
              style={{
                animationDuration: `${duration}s`,
                animationIterationCount: "infinite",
                animationName: "easing-preview",
                animationTimingFunction: cssBezier(bezier),
              }}
            />
          </div>
        )}

        <p className="text-2xs text-muted-foreground">
          A curve only shows while the element moves. Replay to watch it.
        </p>

        {editable ? (
          <div className="dialkit-easing-handles">
            {BEZIER_AXES.map((axis) => (
              <Scrubber
                ariaLabel={`${field.label} ${axis.label}`}
                handle={axis.label}
                key={axis.label}
                max={axis.at % 2 === 0 ? 1 : HANDLE_MAX_Y}
                min={axis.at % 2 === 0 ? 0 : HANDLE_MIN_Y}
                onCommit={(next) => {
                  const draft = [...bezier];
                  draft[axis.at] = next;
                  onChange(field.path, draft);
                }}
                step={0.01}
                value={bezier[axis.at]}
              />
            ))}
          </div>
        ) : null}
      </div>
    </DialControl>
  );
}

function ArrayControl({
  action,
  field,
  onChange,
  original,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
  original: TuningValue | undefined;
}) {
  const values = Array.isArray(field.value) ? field.value : [];
  const originals = Array.isArray(original) ? original : values;
  const canAdd = field.maxLength === null || values.length < field.maxLength;
  const canRemove = field.minLength === null || values.length > field.minLength;

  return (
    <div>
      <div className={ROW}>
        <span className={LABEL}>{field.label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {values.length}
        </span>
        {action}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: as above — a <fieldset>
          brings a min-content width and a legend this list has no room for. */}
      <div
        aria-label={field.label}
        className="flex flex-col gap-1"
        data-slot="array-items"
        role="group"
      >
        {values.map((value, index) => (
          <ArrayItemControl
            action={
              <Button
                aria-label={`Remove ${field.label} ${index + 1}`}
                className="relative size-5 text-muted-foreground after:absolute after:-inset-2"
                disabled={!canRemove}
                onClick={() =>
                  onChange(
                    field.path,
                    values.filter((_, at) => at !== index)
                  )
                }
                size="icon-xs"
                variant="ghost"
              >
                <MinusIcon />
              </Button>
            }
            field={field}
            index={index}
            key={`${field.path}:${index}`}
            onChange={(next) =>
              onChange(
                field.path,
                values.map((entry, at) => (at === index ? next : entry))
              )
            }
            original={originals[index]}
            value={value}
          />
        ))}
      </div>

      <div className={ROW}>
        <span />
        <Button
          aria-label={`Add ${field.label}`}
          className="h-7 justify-start px-2 text-muted-foreground"
          disabled={!canAdd || field.newItemDefault === null}
          onClick={() =>
            field.newItemDefault === null
              ? undefined
              : onChange(field.path, [...values, field.newItemDefault])
          }
          size="xs"
          variant="ghost"
        >
          <PlusIcon />
          Add
        </Button>
        <span />
      </div>
    </div>
  );
}

function ArrayItemControl({
  action,
  field,
  index,
  onChange,
  original,
  value,
}: {
  action: React.ReactNode;
  field: TuningField;
  index: number;
  onChange: (value: TuningValue) => void;
  original: TuningValue | undefined;
  value: TuningValue;
}) {
  const label = `${field.label} ${index + 1}`;

  if (typeof value === "number") {
    const itemField = {
      ...field,
      type: field.arrayItemType ?? "number",
      value,
    };
    const slider = sliderOf(itemField, original);

    if (slider !== null) {
      return (
        <DialControl action={action} title={label}>
          <DialSlider
            label={String(index + 1)}
            max={slider.max}
            min={slider.min}
            onChange={(next) => onChange(valueFromSlider(itemField, next))}
            step={slider.step}
            unit={slider.unit}
            value={slider.value}
          />
        </DialControl>
      );
    }

    return (
      <div className={ROW}>
        <span />
        <Scrubber
          ariaLabel={label}
          handle={String(index + 1)}
          onCommit={onChange}
          value={value}
        />
        {action}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <DialControl action={action}>
        <DialToggle
          checked={value}
          label={String(index + 1)}
          onChange={onChange}
        />
      </DialControl>
    );
  }

  if (typeof value === "string" && field.arrayItemType === "color") {
    return (
      <DialControl action={action}>
        <DialColorControl
          label={String(index + 1)}
          onChange={onChange}
          value={value}
        />
      </DialControl>
    );
  }

  if (typeof value === "string" && field.arrayItemType === "enum") {
    return (
      <DialControl action={action}>
        <DialSelectControl
          label={String(index + 1)}
          onChange={onChange}
          options={[...field.options]}
          value={value}
        />
      </DialControl>
    );
  }

  if (typeof value === "string") {
    return (
      <DialControl action={action}>
        <DialTextControl
          label={String(index + 1)}
          onChange={onChange}
          value={value}
        />
      </DialControl>
    );
  }

  return (
    <div className={ROW}>
      <span />
      <span className={FIELD}>{String(value)}</span>
      {action}
    </div>
  );
}
