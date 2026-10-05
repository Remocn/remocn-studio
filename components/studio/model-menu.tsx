"use client";

import { useCallback } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { ProviderIcon } from "@/components/studio/provider-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProviderAccounts } from "@/hooks/use-provider-accounts";
import { modelLabelOf, PROVIDER_MODELS } from "@/lib/studio/models";
import { providerStatus } from "@/lib/studio/setup";
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
  onSignIn,
  provider,
}: {
  accounts: ProviderAccounts;
  canPickProvider: boolean;
  models: Record<AgentProvider, string>;
  onPick: (provider: AgentProvider, value: string) => void;
  onSignIn: (provider: AgentProvider) => void;
  provider: AgentProvider;
}) {
  const label = modelLabelOf(provider, models[provider]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Model: ${label}`}
            className="min-w-0 shrink"
            size="sm"
            title={`Model: ${label}`}
            variant="ghost"
          />
        }
      >
        <ProviderIcon provider={provider} />
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56">
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
              onSignIn={onSignIn}
              value={candidate === provider ? models[candidate] : ELSEWHERE}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const LOCKED_REASON =
  "This chat already speaks another provider — start a new chat to switch.";

function ProviderGroup({
  accounts,
  candidate,
  disabled,
  locked,
  onPick,
  onSignIn,
  value,
}: {
  accounts: ProviderAccounts;
  candidate: AgentProvider;
  disabled: boolean;
  locked: boolean;
  onPick: (provider: AgentProvider, value: string) => void;
  onSignIn: (provider: AgentProvider) => void;
  value: string;
}) {
  const info = PROVIDER_INFO[candidate];

  const pick = useCallback(
    (picked: string) => onPick(candidate, picked),
    [candidate, onPick]
  );

  const signIn = useCallback(() => onSignIn(candidate), [candidate, onSignIn]);

  const reason = disabledReason(locked, accounts[candidate]);
  const row = accounts[candidate];

  if (!locked && row !== undefined && row.state === "failed") {
    const link = (
      <DropdownMenuItem onClick={signIn}>
        <ProviderIcon className="text-muted-foreground" provider={candidate} />
        <span className="flex-1 whitespace-nowrap">{info.name}</span>
        <StatusMark accounts={accounts} candidate={candidate} />
      </DropdownMenuItem>
    );

    return reason === null ? (
      link
    ) : (
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent className="max-w-64" side="right">
          {reason}
        </TooltipContent>
      </Tooltip>
    );
  }

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
            <DropdownMenuRadioItem
              closeOnClick
              key={choice.value}
              value={choice.value}
            >
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
  return providerStatus(accounts[candidate]);
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
    return row.detail === null
      ? "Opens Settings › AI Accounts."
      : `${row.detail}\n\nOpens Settings › AI Accounts.`;
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
