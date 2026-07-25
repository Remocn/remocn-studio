import { Cause } from "effect";

export function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  return JSON.stringify(cause) ?? String(cause);
}

export function causeMessage(cause: Cause.Cause<unknown>): string | null {
  if (Cause.hasInterruptsOnly(cause)) {
    return null;
  }
  return errorMessage(Cause.squash(cause));
}
