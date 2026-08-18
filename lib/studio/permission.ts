import type {
  PermissionDecision,
  PermissionReason,
  SessionMode,
} from "@/shared/ipc";

export type PermissionAction = PermissionDecision | "cancel";

export interface PermissionChoice {
  action: PermissionAction;
  description: string;
  id: string;
  label: string;
  mode: SessionMode | null;
}

const TITLES: Record<PermissionReason, string> = {
  bash: "Approve this command?",
  outside: "Approve this path outside the project?",
  plan: "Ready to build this plan?",
  tool: "Approve this tool call?",
};

const AGAIN: Record<Exclude<PermissionReason, "plan">, string> = {
  bash: "Don’t ask again for this command this session",
  outside: "Don’t ask again for this path this session",
  tool: "Don’t ask again for this call this session",
};

const PLAN_CHOICES: PermissionChoice[] = [
  {
    action: "allow",
    description: "Edits go through, commands still ask",
    id: "build",
    label: "Approve and build",
    mode: "acceptEdits",
  },
  {
    action: "allow",
    description: "Claude decides what is worth asking about",
    id: "run",
    label: "Approve and let it run",
    mode: "auto",
  },
  {
    action: "deny",
    description: "Send it back and say what to change",
    id: "keep",
    label: "Keep planning",
    mode: null,
  },
  {
    action: "cancel",
    description: "Stop the current turn",
    id: "cancel",
    label: "Cancel turn",
    mode: null,
  },
];

export function permissionTitle(reason: PermissionReason): string {
  return TITLES[reason];
}

export function planText(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const { plan } = input as Record<string, unknown>;
  return typeof plan === "string" && plan.length > 0 ? plan : null;
}

export function permissionChoices(
  reason: PermissionReason
): PermissionChoice[] {
  if (reason === "plan") {
    return PLAN_CHOICES;
  }

  return [
    {
      action: "allow",
      description: "Allow just this request",
      id: "allow",
      label: "Approve once",
      mode: null,
    },
    {
      action: "always",
      description: AGAIN[reason],
      id: "always",
      label: "Always allow this session",
      mode: null,
    },
    {
      action: "deny",
      description: "Reject and let the agent continue",
      id: "deny",
      label: "Decline",
      mode: null,
    },
    {
      action: "cancel",
      description: "Stop the current turn",
      id: "cancel",
      label: "Cancel turn",
      mode: null,
    },
  ];
}
