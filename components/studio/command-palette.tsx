"use client";

import { CheckIcon } from "@/components/icons";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import type {
  CommandPalette as Palette,
  PaletteGroup,
} from "@/hooks/use-command-palette";
import {
  type Command as Entry,
  formatShortcut,
} from "@/lib/studio/command-registry";
import { cn } from "@/lib/utils";

function titleOf(entry: unknown): string {
  return typeof entry === "object" &&
    entry !== null &&
    "title" in entry &&
    typeof entry.title === "string"
    ? entry.title
    : "";
}

function renderItem(entry: Entry) {
  const isDisabled = entry.enabled !== true;

  return (
    <CommandItem
      aria-label={entry.checked ? `${entry.title}, open` : undefined}
      className={cn("flex-wrap", isDisabled && "opacity-64")}
      data-command={entry.id}
      disabled={isDisabled}
      key={entry.id}
      value={entry}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">{entry.title}</span>
        {entry.detail !== undefined && (
          <span className="truncate text-muted-foreground text-xs">
            {entry.detail}
          </span>
        )}
        {entry.checked === true && (
          <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
        )}
      </span>
      {entry.shortcut !== undefined && (
        <CommandShortcut>{formatShortcut(entry.shortcut)}</CommandShortcut>
      )}
      {entry.enabled !== true && (
        <span className="basis-full text-muted-foreground text-xs">
          {entry.enabled.reason}
        </span>
      )}
    </CommandItem>
  );
}

function renderGroup(group: PaletteGroup) {
  return (
    <CommandGroup items={group.items} key={group.id}>
      <CommandGroupLabel>{group.label}</CommandGroupLabel>
      <CommandCollection>{renderItem}</CommandCollection>
    </CommandGroup>
  );
}

export function CommandPalette({ palette }: { palette: Palette }) {
  return (
    <CommandDialog onOpenChange={palette.setOpen} open={palette.isOpen}>
      <CommandDialogPopup aria-label="Commands">
        <Command
          filter={null}
          items={palette.groups}
          itemToStringValue={titleOf}
          onValueChange={palette.onQueryChange}
          value={palette.query}
        >
          <CommandPanel>
            <CommandInput
              onKeyDown={palette.onInputKeyDown}
              placeholder="Search actions, videos and projects"
            />
            <CommandList onClick={palette.onPick}>{renderGroup}</CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
          </CommandPanel>
          <CommandFooter>
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              to move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              to run
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              to close
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
