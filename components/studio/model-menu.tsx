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
import type { ProviderAccounts } from "@/hooks/use-provider-accounts";
import { modelLabelOf, PROVIDER_MODELS } from "@/lib/studio/models";
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
              onPick={onPick}
              value={candidate === provider ? models[candidate] : ELSEWHERE}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderGroup({
  accounts,
  candidate,
  disabled,
  onPick,
  value,
}: {
  accounts: ProviderAccounts;
  candidate: AgentProvider;
  disabled: boolean;
  onPick: (provider: AgentProvider, value: string) => void;
  value: string;
}) {
  const info = PROVIDER_INFO[candidate];

  const pick = useCallback(
    (picked: string) => onPick(candidate, picked),
    [candidate, onPick]
  );

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        disabled={disabled}
        title={accounts[candidate]?.detail ?? undefined}
      >
        <ProviderIcon className="text-muted-foreground" provider={candidate} />
        <span className="flex-1 whitespace-nowrap">{info.name}</span>
        <StatusMark accounts={accounts} candidate={candidate} />
      </DropdownMenuSubTrigger>
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
