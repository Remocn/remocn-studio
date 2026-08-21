"use client";

import {
  BotIcon,
  CheckIcon,
  CircleArrowUpIcon,
  CopyIcon,
  ImagesIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  SunMoonIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCopyCommand } from "@/hooks/use-copy-command";
import { useStockKey } from "@/hooks/use-stock-key";
import {
  isThemeChoice,
  type ThemeChoice,
  useThemeChoice,
} from "@/hooks/use-theme-choice";
import { cn } from "@/lib/utils";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  AGENT_PROVIDERS,
  type AgentProvider,
  PROVIDER_INFO,
} from "@/shared/providers";
import { CHECK_ICONS, CHECK_TONES } from "./environment-checklist";
import { ProviderIcon } from "./provider-icon";
import { useStudio } from "./studio-provider";
import { UpdatesBody } from "./update-status";

const SECTION_IDS = [
  "appearance",
  "behavior",
  "stock",
  "updates",
  "accounts",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

function isSectionId(value: unknown): value is SectionId {
  return (
    typeof value === "string" &&
    (SECTION_IDS as readonly string[]).includes(value)
  );
}

const SECTIONS: readonly {
  description: string;
  icon: typeof SunMoonIcon;
  id: SectionId;
  label: string;
}[] = [
  {
    description: "How the studio looks",
    icon: SunMoonIcon,
    id: "appearance",
    label: "Appearance",
  },
  {
    description: "What the studio does on its own",
    icon: SlidersHorizontalIcon,
    id: "behavior",
    label: "Behavior",
  },
  {
    description: "Searching Pexels from the Assets pane",
    icon: ImagesIcon,
    id: "stock",
    label: "Stock media",
  },
  {
    description: "Keep the studio current",
    icon: CircleArrowUpIcon,
    id: "updates",
    label: "Updates",
  },
  {
    description: "Who answers when a session speaks",
    icon: BotIcon,
    id: "accounts",
    label: "AI Accounts",
  },
];

export function SettingsDialog() {
  const { settingsDialog } = useStudio();
  const [section, setSection] = useState<SectionId>("appearance");

  const onPickSection = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const picked = event.currentTarget.value;
    if (isSectionId(picked)) {
      setSection(picked);
    }
  }, []);

  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];

  return (
    <Dialog onOpenChange={settingsDialog.setOpen} open={settingsDialog.isOpen}>
      <DialogContent className="flex h-[30rem] max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SectionRail active={section} onPick={onPickSection} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 flex-col gap-0.5 px-6 pt-5 pb-1">
            <h2 className="font-heading font-medium">{active.label}</h2>
            <p className="text-muted-foreground text-xs">
              {active.description}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {section === "appearance" ? <AppearanceSection /> : null}
            {section === "behavior" ? <BehaviorSection /> : null}
            {section === "stock" ? <StockSection /> : null}
            {section === "updates" ? <UpdatesSection /> : null}
            {section === "accounts" ? <AccountsSection /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The rail follows the pane's menus: no weight change between states, a
// muted background for the open section, icons leading. The Updates row
// carries a dot while a release is waiting, so the dialog never hides it.
function SectionRail({
  active,
  onPick,
}: {
  active: SectionId;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { updates } = useStudio();

  return (
    <div className="flex w-44 shrink-0 flex-col bg-muted/40 p-3">
      <DialogTitle className="px-2 pt-1 pb-4 text-sm">Settings</DialogTitle>

      <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
        {SECTIONS.map((entry) => (
          <button
            aria-current={active === entry.id ? "true" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-accent",
              active === entry.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            key={entry.id}
            onClick={onPick}
            type="button"
            value={entry.id}
          >
            <entry.icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.id === "updates" && updates.release !== null ? (
              <span
                aria-label="An update is available"
                className="size-1.5 shrink-0 rounded-full bg-primary"
                role="status"
              />
            ) : null}
          </button>
        ))}
      </nav>

      <p className="mt-auto flex items-center gap-1.5 whitespace-nowrap px-2 text-muted-foreground text-xs">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>,</Kbd>
        </KbdGroup>
        opens Settings
      </p>
    </div>
  );
}

const THEME_TILES: readonly {
  caption: string;
  id: ThemeChoice;
  label: string;
  swatch: string;
  bar: string;
  chip: string;
}[] = [
  {
    bar: "bg-white/25",
    caption: "The studio’s native palette",
    chip: "bg-white/10",
    id: "dark",
    label: "Dark",
    swatch: "bg-[#141318]",
  },
  {
    bar: "bg-black/40",
    caption: "Bright surfaces, dark text",
    chip: "bg-black/10",
    id: "light",
    label: "Light",
    swatch: "bg-white",
  },
  {
    bar: "bg-white/25",
    caption: "Follows macOS",
    chip: "bg-black/25",
    id: "system",
    label: "System",
    swatch: "bg-linear-to-br from-[#141318] from-50% to-white to-50%",
  },
];

function AppearanceSection() {
  const { choice, select } = useThemeChoice();

  const onPickTheme = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isThemeChoice(picked)) {
        select(picked);
      }
    },
    [select]
  );

  return (
    <section aria-label="Theme" className="flex flex-col gap-3">
      <h3 className="text-sm">Theme</h3>

      <div className="flex gap-3">
        {THEME_TILES.map((tile) => (
          <button
            aria-pressed={choice === tile.id}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-2 rounded-lg outline-none active:translate-y-px"
            key={tile.id}
            onClick={onPickTheme}
            type="button"
            value={tile.id}
          >
            <span
              className={cn(
                "flex h-16 flex-col justify-between rounded-md p-2 ring-1 ring-foreground/10 ring-inset transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring",
                tile.swatch,
                choice === tile.id && "ring-2 ring-primary"
              )}
            >
              <span className={cn("h-1.5 w-1/2 rounded-full", tile.bar)} />
              <span className={cn("h-4 w-2/3 self-end rounded", tile.chip)} />
            </span>
            <span
              className={cn(
                "text-xs",
                choice === tile.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tile.label}
            </span>
          </button>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        {THEME_TILES.find((tile) => tile.id === choice)?.caption ??
          "Dark is the default until a choice is made"}
      </p>
    </section>
  );
}

function BehaviorSection() {
  const { preferences } = useStudio();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-sm" htmlFor="settings-asset-offers">
            Library suggestions
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            When a turn ends, offer to save the pictures and clips it carried
            into the asset library
          </p>
        </div>
        <Switch
          checked={preferences.assetOffers}
          className="mt-0.5"
          id="settings-asset-offers"
          onCheckedChange={preferences.setAssetOffers}
        />
      </div>
    </div>
  );
}

function UpdatesSection() {
  const { updates } = useStudio();

  return (
    <div className="flex flex-col gap-3">
      <UpdatesBody updates={updates} />
    </div>
  );
}

function AccountsSection() {
  const { accounts } = useStudio();

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Each provider is asked with its own probe — a session can only start
          on one that is signed in
        </p>
        <Button
          disabled={accounts.isChecking}
          onClick={accounts.recheck}
          size="xs"
          variant="ghost"
        >
          {accounts.isChecking ? (
            <Spinner className="size-3" data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Recheck
        </Button>
      </div>

      {AGENT_PROVIDERS.map((provider) => (
        <AccountRow
          isChecking={accounts.isChecking}
          key={provider}
          provider={provider}
          row={accounts.rows[provider]}
        />
      ))}
    </div>
  );
}

function AccountRow({
  isChecking,
  provider,
  row,
}: {
  isChecking: boolean;
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const info = PROVIDER_INFO[provider];
  const StateIcon = row === undefined ? null : CHECK_ICONS[row.state];

  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <ProviderIcon className="size-4" provider={provider} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm">
          {info.name}
          {info.experimental ? (
            <Badge className="text-[10px]" variant="outline">
              Experimental
            </Badge>
          ) : null}
        </span>

        <AccountStatus isChecking={isChecking} row={row} />
      </div>

      {StateIcon === null || row === undefined ? null : (
        <StateIcon
          aria-hidden="true"
          className={cn("mt-1 size-3.5 shrink-0", CHECK_TONES[row.state])}
        />
      )}
    </div>
  );
}

// A provider with no row yet is presented plainly: "unknown" must never read
// as "signed out".
function AccountStatus({
  isChecking,
  row,
}: {
  isChecking: boolean;
  row: EnvironmentCheck | undefined;
}) {
  const { copied, onCopy } = useCopyCommand();

  if (row === undefined) {
    return (
      <span className="text-muted-foreground text-xs">
        {isChecking ? "Checking…" : "Not checked yet"}
      </span>
    );
  }

  return (
    <>
      <span className="text-muted-foreground text-xs leading-snug">
        {row.title}
      </span>

      {row.detail === null ? null : (
        <span className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-snug">
          {row.detail}
        </span>
      )}

      {row.fix?.type === "command" ? (
        <span className="mt-1 flex items-center gap-2">
          <code className="select-text rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {row.fix.command}
          </code>
          <Button
            onClick={onCopy}
            size="xs"
            value={row.fix.command}
            variant="ghost"
          >
            {copied === row.fix.command ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied === row.fix.command ? "Copied" : "Copy"}
          </Button>
        </span>
      ) : null}
    </>
  );
}

function StockSection() {
  const stockKey = useStockKey();
  const canSave = stockKey.value.trim().length > 0;

  return (
    <section aria-label="Pexels" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-sm" htmlFor="settings-pexels-key">
          Pexels API key
        </Label>
        <p className="text-muted-foreground text-xs leading-snug">
          The key is free at pexels.com/api. It is kept in the studio’s own data
          folder on this machine and never leaves it except to talk to Pexels.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="h-8 flex-1"
          id="settings-pexels-key"
          onChange={stockKey.onChange}
          placeholder={
            stockKey.isConfigured === true ? "A key is saved" : "Paste your key"
          }
          type="password"
          value={stockKey.value}
        />
        <Button
          disabled={!canSave}
          onClick={stockKey.onSave}
          size="sm"
          variant="outline"
        >
          Save
        </Button>
        {stockKey.isConfigured === true ? (
          <Button onClick={stockKey.onForget} size="sm" variant="ghost">
            Remove
          </Button>
        ) : null}
      </div>

      {stockKey.error === null ? null : (
        <p className="break-words text-destructive text-xs">{stockKey.error}</p>
      )}
    </section>
  );
}
