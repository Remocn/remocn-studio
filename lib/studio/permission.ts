import type { PermissionDecision, PermissionReason } from "@/shared/ipc";

export type PermissionAction = PermissionDecision | "cancel";

export interface PermissionChoice {
  action: PermissionAction;
  description: string;
  label: string;
}

const TITLES: Record<PermissionReason, string> = {
  bash: "Approve this command?",
  outside: "Approve this path outside the project?",
  tool: "Approve this tool call?",
};

const AGAIN: Record<PermissionReason, string> = {
  bash: "Don't ask again for this command this session",
  outside: "Don't ask again for this path this session",
  tool: "Don't ask again for this call this session",
};

export function permissionTitle(reason: PermissionReason): string {
  return TITLES[reason];
}

export function permissionChoices(
  reason: PermissionReason
): PermissionChoice[] {
  return [
    {
      action: "allow",
      description: "Allow just this request",
      label: "Approve once",
    },
    {
      action: "always",
      description: AGAIN[reason],
      label: "Always allow this session",
    },
    {
      action: "deny",
      description: "Reject and let the agent continue",
      label: "Decline",
    },
    {
      action: "cancel",
      description: "Stop the current turn",
      label: "Cancel turn",
    },
  ];
}
