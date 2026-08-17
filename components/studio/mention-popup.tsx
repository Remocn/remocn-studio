"use client";

import { CornerDownLeftIcon, FileIcon, FolderIcon } from "lucide-react";
import { memo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useKeptInView } from "@/hooks/use-kept-in-view";
import type { MentionItem, Mentions } from "@/hooks/use-mentions";
import { cn } from "@/lib/utils";

function MentionPopupBlock({ mentions }: { mentions: Mentions }) {
  if (!mentions.isOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 bottom-full left-0 z-20 mb-2">
      <div className="overflow-hidden rounded-xl bg-popover p-1.5 shadow-[var(--elevation-floating)]">
        {mentions.items.length > 0 ? (
          <div className="max-h-64 space-y-0.5 overflow-y-auto" role="listbox">
            {mentions.items.map((item, index) => (
              <MentionRow
                index={index}
                isActive={index === mentions.active}
                item={item}
                key={item.path}
                keyed={mentions.keyed}
                onChoose={mentions.onChoose}
                onHold={mentions.onHold}
                onPoint={mentions.onPoint}
              />
            ))}
          </div>
        ) : (
          <Nothing mentions={mentions} />
        )}
      </div>
    </div>
  );
}

export const MentionPopup = memo(MentionPopupBlock);

function MentionRow({
  index,
  isActive,
  item,
  keyed,
  onChoose,
  onHold,
  onPoint,
}: {
  index: number;
  isActive: boolean;
  item: MentionItem;
  keyed: number;
  onChoose: Mentions["onChoose"];
  onHold: Mentions["onHold"];
  onPoint: Mentions["onPoint"];
}) {
  const Icon = item.folder ? FolderIcon : FileIcon;
  const ref = useKeptInView<HTMLButtonElement>(isActive, `${keyed}:${index}`);

  return (
    <button
      aria-selected={isActive}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none",
        isActive && "bg-muted"
      )}
      onClick={onChoose}
      onMouseDown={onHold}
      onMouseMove={onPoint}
      ref={ref}
      role="option"
      type="button"
      value={index}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 truncate text-foreground">{item.label}</span>
      {item.hint === "" ? null : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
          {item.hint}
        </span>
      )}
      {isActive ? (
        <CornerDownLeftIcon className="ml-auto size-3 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}

function Nothing({ mentions }: { mentions: Mentions }) {
  if (mentions.isLoading) {
    return (
      <p className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-sm">
        <Spinner className="size-3" />
        Reading the folder…
      </p>
    );
  }

  return (
    <p
      className={cn(
        "px-2 py-1.5 text-sm",
        mentions.error === null ? "text-muted-foreground" : "text-destructive"
      )}
    >
      {mentions.error ?? mentions.note ?? "No matching files"}
    </p>
  );
}
