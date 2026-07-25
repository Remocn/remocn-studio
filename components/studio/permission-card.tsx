"use client";

import { usePermissionCard } from "@/hooks/use-permission-card";
import { toolTarget } from "@/lib/studio/activity";
import {
  type PermissionAction,
  permissionChoices,
  permissionTitle,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function PermissionCard({
  cwd,
  onAnswer,
  permission,
}: {
  cwd: string | null;
  onAnswer: (id: string, action: PermissionAction) => void;
  permission: PendingPermission;
}) {
  const card = usePermissionCard(permission.id, onAnswer);
  const target = toolTarget(permission.input, cwd);

  return (
    <Card
      aria-label={permissionTitle(permission.reason)}
      className="bg-input/50 ring-none"
      data-slot="permission-card"
      size="sm"
    >
      <CardHeader>
        <CardTitle>
          {permissionTitle(permission.reason)}
          <span className="text-muted-foreground"> {permission.name}</span>
        </CardTitle>

        {target === null ? null : (
          <p className="wrap-break-word whitespace-pre-wrap rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-foreground text-xs leading-relaxed">
            {target}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex flex-col">
          {permissionChoices(permission.reason).map((choice) => (
            <button
              className="-mx-1 flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              key={choice.action}
              onClick={card.onChoose}
              type="button"
              value={choice.action}
            >
              <span className="shrink-0 text-sm">{choice.label}</span>
              <span className="truncate text-muted-foreground text-xs">
                {choice.description}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
