import type { Value } from "../studio-objects-v7";

export interface ParameterField {
  readonly id: string;
  readonly integer?: boolean;
  readonly max?: number;
  readonly maxItems?: number;
  readonly min?: number;
  readonly minItems?: number;
  readonly options?: readonly string[];
  readonly type: string;
}
const HEX = /^#[\da-f]{6}([\da-f]{2})?$/i;
function valid(field: ParameterField, value: Value | undefined): boolean {
  switch (field.type) {
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (!field.integer || Number.isInteger(value)) &&
        (field.min === undefined || value >= field.min) &&
        (field.max === undefined || value <= field.max)
      );
    case "color":
      return typeof value === "string" && HEX.test(value);
    case "palette":
      return (
        Array.isArray(value) &&
        value.length >= (field.minItems ?? 1) &&
        value.length <= (field.maxItems ?? 10) &&
        value.every((color) => typeof color === "string" && HEX.test(color))
      );
    case "enum":
      return (
        typeof value === "string" && field.options?.includes(value) === true
      );
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}
export function parameters(
  fields: readonly ParameterField[],
  values: Readonly<Record<string, Value | undefined>>
) {
  for (const field of fields) {
    if (!valid(field, values[field.id])) {
      throw new Error(`Invalid shader parameter: ${field.id}`);
    }
  }
  return values as Readonly<Record<string, Value>>;
}
