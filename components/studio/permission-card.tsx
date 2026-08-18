"use client";

import { usePermissionCard } from "@/hooks/use-permission-card";
import { toolTarget } from "@/lib/studio/activity";
import {
  type PermissionAction,
  permissionChoices,
  permissionTitle,
  planText,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import { cn } from "@/lib/utils";
import type { SessionMode } from "@/shared/ipc";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Markdown } from "./markdown";

export function PermissionCard({
  cwd,
  onAnswer,
  permission,
}: {
  cwd: string | null;
  onAnswer: (
    id: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void;
  permission: PendingPermission;
}) {
  const card = usePermissionCard(permission, onAnswer);
  const plan = permission.reason === "plan" ? planText(permission.input) : null;
  const target = plan === null ? toolTarget(permission.input, cwd) : null;

  return (
    <Card
      aria-label={permissionTitle(permission.reason)}
      className="bg-input/50 ring-none"
      data-slot="permission-card"
      onKeyDown={card.onKeyDown}
      size="sm"
    >
      <CardHeader>
        <CardTitle>
          {permissionTitle(permission.reason)}
          {plan === null ? (
            <span className="text-muted-foreground"> {permission.name}</span>
          ) : null}
        </CardTitle>

        {plan === null ? null : (
          <div className="max-h-56 overflow-y-auto rounded-lg bg-muted/50 px-2.5 py-1.5">
            <Markdown className="text-xs">{plan}</Markdown>
          </div>
        )}

        {target === null ? null : (
          <p className="wrap-break-word whitespace-pre-wrap rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-foreground text-xs leading-relaxed">
            {target}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex flex-col">
          {permissionChoices(permission.reason).map((choice, index) => (
            <button
              className="-mx-1 flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/80"
              key={choice.id}
              onClick={card.onChoose}
              ref={index === 0 ? card.first : undefined}
              type="button"
              value={choice.id}
            >
              <span
                className={cn(
                  "shrink-0 text-sm",
                  index === 0 && "font-medium",
                  choice.action === "cancel" && "text-destructive"
                )}
              >
                {choice.label}
              </span>
              <span className="min-w-0 text-pretty text-muted-foreground text-xs">
                {choice.description}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
