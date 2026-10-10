"use client";

import { formatHex, formatHex8, parse } from "culori";
import {
  ColorControl,
  EasingVisualization,
  SelectControl,
  Slider,
  TextControl,
  Toggle,
} from "dialkit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialCommit } from "@/hooks/use-dial-commit";
import type { ManagedObjects } from "@/hooks/use-managed-objects";
import type { PropGroups } from "@/hooks/use-prop-groups";
import {
  BEZIER_PRESETS,
  bezierOfValue,
  easingNameToBezier,
  matchPresetLabel,
  presetByLabel,
} from "@/lib/studio/easing";
import {
  type PropertyTab,
  propertyGroup,
  propertyGroupLabel,
  propertyLabel,
  propertyTab,
  readableLabel,
} from "@/lib/studio/property-presentation";
import {
  fieldUnavailableReason,
  isStudioPalette,
  type StudioBezier,
  type StudioValue,
} from "@/shared/studio-document";
import { GroupHeading } from "./prop-group-heading";
import { PropertyDisclosure } from "./property-disclosure";
import { ShaderPalette } from "./shader-palette";

const EASING_FIELD = /((^|\.)ease|easing)$/i;
const FRAMES_LABEL = /frames/gi;

type Field = ManagedObjects["fields"][number];

export function ManagedFields({
  objects,
  groups,
  fps,
  tab,
}: {
  objects: ManagedObjects;
  groups?: PropGroups;
  fps?: number;
  tab?: PropertyTab;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggle = useCallback(
    (group: string) =>
      setCollapsed((previous) =>
        previous.includes(group)
          ? previous.filter((item) => item !== group)
          : [...previous, group]
      ),
    []
  );
  const visible = objects.fields.filter(
    (field) => !tab || propertyTab(field) === tab
  );
  const grouped = Map.groupBy(visible, propertyGroup);
  const changed = useDialCommit(objects.commit);
  return (
    <div className="managed-properties flex flex-col pb-2">
      {visible.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground text-xs">
          No {tab === "animation" ? "animation" : "appearance"} controls for
          this element.
        </p>
      ) : null}
      {[...grouped].map(([group, fields]) => {
        const isOpen = !(groups?.collapsed ?? collapsed).includes(group);
        return (
          <section
            className="px-4 py-3 [&>h3]:pb-0"
            data-open={isOpen}
            key={group}
          >
            <GroupHeading
              count={fields.length}
              group={group}
              isOpen={isOpen}
              label={propertyGroupLabel(group)}
              onToggle={groups ? groups.toggle : toggle}
            />
            <div className="pt-1.5 pb-0.5" hidden={!isOpen}>
              <FieldSection
                changed={changed}
                fields={fields}
                fps={fps}
                objects={objects}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

const PAIRED_FIELDS: Record<string, string> = {
  end: "start",
  fontSize: "fontWeight",
  fontWeight: "fontSize",
  height: "width",
  letterSpacing: "lineHeight",
  lineHeight: "letterSpacing",
  paddingX: "paddingY",
  paddingY: "paddingX",
  start: "end",
  width: "height",
  x: "y",
  y: "x",
};
const PHYSICS = new Set(["damping", "stiffness", "mass"]);
const TEXT_DETAILS = new Set(["letterSpacing", "lineHeight"]);

function FieldSection({
  fields,
  objects,
  fps,
  changed,
}: {
  fields: Field[];
  objects: ManagedObjects;
  fps?: number;
  changed: () => void;
}) {
  const spring = objects.fields.find(
    (field) => field.id === "spring" && field.type === "boolean"
  );
  const curves = fields.filter(
    (field) => field.type === "easing" || EASING_FIELD.test(field.id)
  );
  const primary = fields.filter(
    (field) =>
      !(
        PHYSICS.has(field.id) ||
        TEXT_DETAILS.has(field.id) ||
        curves.includes(field)
      )
  );
  const physics = fields.filter((field) => PHYSICS.has(field.id));
  const typography = fields.filter((field) => TEXT_DETAILS.has(field.id));
  const rows = (items: Field[]) => {
    const remaining = new Set(items);
    const pairedRows: [Field, ...Field[]][] = [];
    for (const field of items) {
      if (!remaining.delete(field)) {
        continue;
      }
      const partner =
        field.type === "number"
          ? items.find(
              (item) =>
                item.id === PAIRED_FIELDS[field.id] &&
                item.type === "number" &&
                remaining.has(item)
            )
          : undefined;
      if (partner) {
        remaining.delete(partner);
      }
      pairedRows.push(partner ? [field, partner] : [field]);
    }
    return items.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        {pairedRows.map((row) => (
          <div
            className={
              row.length === 2 ? "grid min-w-0 grid-cols-2 gap-1.5" : "min-w-0"
            }
            key={row[0].id}
          >
            {row.map((field) => (
              <div className="min-w-0" key={field.id}>
                <ManagedControl
                  field={{
                    ...field,
                    label: propertyLabel(field, objects.fields),
                  }}
                  fps={fps}
                  onChange={objects.change}
                  onCommit={objects.commit}
                  onContinuousChange={changed}
                  reason={fieldUnavailableReason(
                    field,
                    Object.fromEntries(
                      objects.fields.map((item) => [item.id, item.value])
                    )
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null;
  };
  return (
    <div className="flex flex-col gap-1.5">
      {rows(primary)}
      {typography.length > 0 ? (
        <PropertyDisclosure label="Text spacing">
          {rows(typography)}
        </PropertyDisclosure>
      ) : null}
      {physics.length > 0 && spring?.value !== false ? (
        <PropertyDisclosure
          defaultOpen={spring?.value === true}
          label="Spring settings"
        >
          {rows(physics)}
        </PropertyDisclosure>
      ) : null}
      {rows(curves)}
    </div>
  );
}

interface ControlProps {
  field: Field;
  fps?: number;
  onChange: ManagedObjects["change"];
  onCommit: () => void;
  onContinuousChange: () => void;
  reason: string | null;
}

function ManagedControl({
  reason,
  field,
  fps,
  onChange,
  onCommit,
  onContinuousChange,
}: ControlProps) {
  const frameUnit = field.type === "number" && field.unit === "frames";
  const scale = frameUnit && fps !== undefined && fps > 0 ? fps : 1;
  const unavailable =
    reason ??
    (frameUnit && !(fps !== undefined && fps > 0)
      ? "Timing is available when the preview is ready."
      : null);
  const toStored = useCallback(
    (value: number) => {
      if (!frameUnit) {
        return value;
      }
      const scaled = value * scale;
      const step = field.step ?? 1;
      const base = field.min ?? 0;
      const snapped = step
        ? base + Math.round((scaled - base) / step) * step
        : scaled;
      return Math.min(
        field.max ?? Number.POSITIVE_INFINITY,
        Math.max(
          field.min ?? Number.NEGATIVE_INFINITY,
          Number(snapped.toPrecision(12))
        )
      );
    },
    [scale, field.step, field.min, field.max, frameUnit]
  );
  const root = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const element = root.current;
    if (field.type !== "text" || !element) {
      return;
    }
    element.addEventListener("focusout", onCommit);
    return () => element.removeEventListener("focusout", onCommit);
  }, [field.type, onCommit]);
  const change = useCallback(
    (value: StudioValue) => {
      if (field.saving) {
        return;
      }
      let next = value;
      if (field.type === "color" && typeof value === "string") {
        const color = parse(value);
        if (!color) {
          return;
        }
        next =
          (color.alpha !== undefined && color.alpha < 1
            ? formatHex8(color)
            : formatHex(color)) ?? value;
      }
      onChange(field.id, typeof next === "number" ? toStored(next) : next);
      if (field.type === "boolean" || field.type === "enum") {
        onCommit();
      } else if (field.type !== "text") {
        onContinuousChange();
      }
    },
    [
      field.id,
      field.saving,
      field.type,
      onChange,
      onCommit,
      onContinuousChange,
      toStored,
    ]
  );
  const displayField = frameUnit ? secondsField(field, scale) : field;
  return (
    <fieldset
      aria-label={`${field.label} property`}
      className="min-w-0 border-0 p-0 disabled:opacity-60"
      data-control-type={field.type}
      disabled={
        field.saving ||
        unavailable !== null ||
        (field.min !== undefined && field.min === field.max)
      }
      inert={
        field.saving ||
        unavailable !== null ||
        (field.min !== undefined && field.min === field.max)
      }
      ref={root}
    >
      {unavailable ? null : <Control change={change} field={displayField} />}
      {unavailable ? (
        <p className="text-muted-foreground text-xs">{unavailable}</p>
      ) : null}
      {field.error ? (
        <p className="mt-1 text-destructive text-xs" role="alert">
          {field.error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Control({
  field,
  change,
}: {
  field: Field;
  change: (value: StudioValue) => void;
}) {
  if (field.type === "palette" && isStudioPalette(field.value)) {
    return (
      <ShaderPalette
        label={field.label}
        max={field.maxItems}
        min={field.minItems}
        onChange={change}
        value={field.value}
      />
    );
  }
  if (field.type === "easing") {
    return <ManagedEasing change={change} field={field} />;
  }
  if (field.type === "boolean") {
    return (
      <Toggle
        checked={field.value === true}
        label={field.label}
        onChange={change}
      />
    );
  }
  if (field.type === "enum") {
    const easing = EASING_FIELD.test(field.id)
      ? easingNameToBezier(String(field.value))
      : null;
    return (
      <div className="grid gap-2">
        {easing ? (
          <EasingVisualization
            easing={{ duration: 1, ease: [...easing], type: "easing" }}
          />
        ) : null}
        <SelectControl
          label={field.label}
          onChange={change}
          options={(field.options ?? []).map((value) => ({
            label: readableLabel(value),
            value,
          }))}
          value={String(field.value)}
        />
      </div>
    );
  }
  if (field.type === "color") {
    return (
      <ColorControl
        label={field.label}
        onChange={change}
        value={String(field.value)}
      />
    );
  }
  if (field.type === "text") {
    return (
      <TextControl
        label={field.label}
        onChange={change}
        value={String(field.value)}
      />
    );
  }
  return <NumericControl change={change} field={field} />;
}

function NumericControl({
  field,
  change,
}: {
  field: Field;
  change: (value: StudioValue) => void;
}) {
  const value =
    typeof field.value === "number" ? field.value : Number(field.default);
  const [initial] = useState(value);
  const span = Math.max(field.unit === "s" ? 10 : 100, Math.abs(initial) * 2);
  // DialKit derives display precision from the step and range bounds.
  const min = field.min ?? Math.floor(Math.min(0, initial - span));
  const max = field.max ?? Math.ceil(Math.max(min + span, initial + span));
  return (
    <Slider
      label={field.label}
      max={max === min ? min + (field.step ?? 1) : max}
      min={min}
      onChange={change}
      step={field.step ?? 0.01}
      unit={field.unit}
      value={value}
    />
  );
}

function secondsField(field: Field, fps: number): Field {
  const step = Number(((field.step ?? 1) / fps).toFixed(6));
  const min = Number(((field.min ?? 0) / fps).toFixed(6));
  return {
    ...field,
    default: Number(field.default) / fps,
    label: field.label.replace(FRAMES_LABEL, "duration"),
    max:
      field.max === undefined
        ? undefined
        : Number((field.max / fps).toFixed(6)),
    min: field.min === undefined ? undefined : min,
    step,
    unit: "s",
    value:
      min +
      ((Number(field.value) - (field.min ?? 0)) / (field.step ?? 1)) * step,
  };
}

const BEZIER_AXES = ["X1", "Y1", "X2", "Y2"] as const;

function ManagedEasing({
  field,
  change,
}: {
  field: Field;
  change: (value: StudioValue) => void;
}) {
  const curve = bezierOfValue(field.value);
  const editCurve = useCallback(
    (next: StudioBezier) => change([...next]),
    [change]
  );
  const choosePreset = useCallback(
    (label: string) => {
      const preset = presetByLabel(label);
      if (preset) {
        change([...preset]);
      }
    },
    [change]
  );
  if (!curve) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <span className="dialkit-composite-label">{field.label}</span>
      <EasingVisualization
        easing={{ duration: 1, ease: [...curve], type: "easing" }}
        onChange={editCurve}
      />
      <SelectControl
        label="Preset"
        onChange={choosePreset}
        options={BEZIER_PRESETS.map((preset) => preset.label)}
        value={matchPresetLabel(curve) ?? "Custom"}
      />
      <PropertyDisclosure label="Curve coordinates">
        <div className="grid grid-cols-2 gap-2">
          {BEZIER_AXES.map((axis, index) => (
            <EasingAxis
              change={change}
              curve={curve}
              index={index}
              key={axis}
              label={`${field.label} ${axis}`}
            />
          ))}
        </div>
      </PropertyDisclosure>
    </div>
  );
}

function EasingAxis({
  label,
  index,
  curve,
  change,
}: {
  label: string;
  index: number;
  curve: StudioBezier;
  change: (value: StudioValue) => void;
}) {
  const update = useCallback(
    (value: number) => {
      const next: [number, number, number, number] = [...curve];
      next[index] = value;
      change(next);
    },
    [curve, index, change]
  );
  return (
    <Slider
      label={label}
      max={index % 2 === 0 ? 1 : Math.max(2, curve[index])}
      min={index % 2 === 0 ? 0 : Math.min(-2, curve[index])}
      onChange={update}
      step={0.01}
      value={curve[index]}
    />
  );
}
