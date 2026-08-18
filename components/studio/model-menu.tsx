"use client";

import { ChevronDownIcon } from "lucide-react";
import { useCallback } from "react";
import { ProviderIcon } from "@/components/studio/provider-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProviderAccounts } from "@/hooks/use-provider-accounts";
import { modelLabelOf, PROVIDER_MODELS } from "@/lib/studio/models";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  AGENT_PROVIDERS,
  type AgentProvider,
  PROVIDER_INFO,
} from "@/shared/providers";

// No model of another provider ever matches this, so inactive groups render
// without a check mark.
const ELSEWHERE = "elsewhere";

export function ModelMenu({
  accounts,
  canPickProvider,
  models,
  onPick,
  provider,
}: {
  accounts: ProviderAccounts;
  canPickProvider: boolean;
  models: Record<AgentProvider, string>;
  onPick: (provider: AgentProvider, value: string) => void;
  provider: AgentProvider;
}) {
  const label = modelLabelOf(provider, models[provider]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton aria-label={`Model: ${label}`} variant="ghost" />
        }
      >
        <ProviderIcon provider={provider} />
        {label}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {AGENT_PROVIDERS.map((candidate) => (
            <ProviderGroup
              accounts={accounts}
              candidate={candidate}
              disabled={groupDisabled(
                candidate,
                provider,
                canPickProvider,
                accounts
              )}
              key={candidate}
              locked={candidate !== provider && !canPickProvider}
              onPick={onPick}
              value={candidate === provider ? models[candidate] : ELSEWHERE}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const LOCKED_REASON =
  "This session already speaks another provider — start a new session to switch.";

function ProviderGroup({
  accounts,
  candidate,
  disabled,
  locked,
  onPick,
  value,
}: {
  accounts: ProviderAccounts;
  candidate: AgentProvider;
  disabled: boolean;
  locked: boolean;
  onPick: (provider: AgentProvider, value: string) => void;
  value: string;
}) {
  const info = PROVIDER_INFO[candidate];

  const pick = useCallback(
    (picked: string) => onPick(candidate, picked),
    [candidate, onPick]
  );

  const reason = disabledReason(locked, accounts[candidate]);

  const trigger = (
    <DropdownMenuSubTrigger
      className="data-disabled:opacity-50"
      disabled={disabled}
    >
      <ProviderIcon className="text-muted-foreground" provider={candidate} />
      <span className="flex-1 whitespace-nowrap">{info.name}</span>
      <StatusMark accounts={accounts} candidate={candidate} />
    </DropdownMenuSubTrigger>
  );

  return (
    <DropdownMenuSub>
      {reason === null ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent className="max-w-64" side="right">
            {reason}
          </TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={pick} value={value}>
          {PROVIDER_MODELS[candidate].map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function StatusMark({
  accounts,
  candidate,
}: {
  accounts: ProviderAccounts;
  candidate: AgentProvider;
}) {
  const status = statusOf(candidate, accounts);
  if (status === null) {
    return null;
  }

  return (
    <span className="whitespace-nowrap pl-4 text-muted-foreground text-xs">
      {status}
    </span>
  );
}

// "unknown" must never read as "signed out": with no row yet, a provider is
// presented plainly, and only a probe that answered failed marks the group.
function statusOf(
  candidate: AgentProvider,
  accounts: ProviderAccounts
): string | null {
  const row = accounts[candidate];

  if (row !== undefined && row.state === "failed") {
    return row.fix?.type === "command" && row.fix.command.includes("login")
      ? "Sign in"
      : "Unavailable";
  }

  return PROVIDER_INFO[candidate].experimental ? "Experimental" : null;
}

// A tooltip is for a group you cannot open — the lock, or a failed probe's
// own detail. A healthy group explains nothing, or the balloon would sit on
// top of the submenu it just opened.
function disabledReason(
  locked: boolean,
  row: EnvironmentCheck | undefined
): string | null {
  if (locked) {
    return LOCKED_REASON;
  }
  if (row !== undefined && row.state === "failed") {
    return row.detail;
  }
  return null;
}

function groupDisabled(
  candidate: AgentProvider,
  provider: AgentProvider,
  canPickProvider: boolean,
  accounts: ProviderAccounts
): boolean {
  if (candidate !== provider && !canPickProvider) {
    return true;
  }
  return accounts[candidate]?.state === "failed";
}
