import type { PermissionReason } from "@/shared/ipc";

export type PermissionVerdict =
  | { readonly kind: "allow" }
  | {
      readonly kind: "ask";
      readonly reason: PermissionReason;
      readonly signature: string;
    };

export function signatureOf(toolName: string, detail: string): string {
  return JSON.stringify([toolName, detail]);
}
