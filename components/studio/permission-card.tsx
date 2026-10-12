"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { usePermissionCard } from "@/hooks/use-permission-card";
import { toolTarget } from "@/lib/studio/activity";
import { type PermissionAction, planText } from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import { cn } from "@/lib/utils";
import type { SessionMode } from "@/shared/ipc";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { CheckboxGroup } from "../ui/checkbox-group";
import { Markdown } from "./markdown";

export function PermissionCard({
  asks,
  cwd,
  onAnswer,
  permission,
}: {
  asks?: readonly PendingPermission[];
  cwd: string | null;
  onAnswer: (
    id: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void;
  permission: PendingPermission;
}) {
  const descriptionId = useId();
  const card = usePermissionCard(permission, asks, onAnswer);
  const plan = permission.reason === "plan" ? planText(permission.input) : null;
  const target =
    plan === null && !card.gathered ? toolTarget(permission.input, cwd) : null;

  return (
    <Card
      aria-label={card.title}
      data-slot="permission-card"
      onKeyDown={card.onKeyDown}
    >
      <CardHeader className="gap-1 p-4">
        <CardTitle className="text-sm">
          {card.title}
          {plan === null && !card.gathered ? (
            <span className="text-muted-foreground"> {permission.name}</span>
          ) : null}
        </CardTitle>

        {card.gathered ? (
          <CheckboxGroup
            aria-label="Requests on this card"
            className="mt-1 max-h-56 w-full gap-1.5 overflow-y-auto"
            onValueChange={card.onCheck}
            value={card.checked}
          >
            {card.asks.map((ask) => (
              <div
                className="flex w-full items-start gap-2.5 rounded-md bg-muted/50 px-2.5 py-1.5"
                key={ask.id}
              >
                <Checkbox
                  aria-labelledby={`permission-ask-${ask.id}`}
                  className="mt-0.5"
                  value={ask.id}
                />
                <div className="min-w-0 flex-1" id={`permission-ask-${ask.id}`}>
                  <p className="text-muted-foreground text-xs">{ask.name}</p>
                  <p className="wrap-break-word whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
                    {toolTarget(ask.input, cwd)}
                  </p>
                </div>
              </div>
            ))}
          </CheckboxGroup>
        ) : null}

        {plan === null ? null : (
          <div className="max-h-56 overflow-y-auto rounded-md bg-muted/50 px-2.5 py-1.5">
            <Markdown className="text-xs">{plan}</Markdown>
          </div>
        )}

        {target === null ? null : (
          <p className="wrap-break-word whitespace-pre-wrap rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-foreground text-xs leading-relaxed">
            {target}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex flex-col gap-1.5">
          {card.choices.map((choice, index) => (
            <Button
              aria-describedby={`${descriptionId}-${choice.id}`}
              aria-label={choice.label}
              className={cn(
                "h-auto min-h-9 pointer-coarse:min-h-11 whitespace-normal px-2.5 py-2",
                choice.action === "cancel" &&
                  "mt-2.5 text-destructive-foreground"
              )}
              disabled={choice.disabled === true}
              key={choice.id}
              onClick={card.onChoose}
              ref={index === 0 ? card.first : undefined}
              title={choice.description}
              type="button"
              value={choice.id}
              variant={index === 0 ? "default" : "ghost"}
            >
              {choice.label}
              <span className="sr-only" id={`${descriptionId}-${choice.id}`}>
                {choice.description}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
