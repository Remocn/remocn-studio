"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  ImagePlusIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useComposer } from "@/hooks/use-composer";
import { type Sidecar, useSidecar } from "@/hooks/use-sidecar";
import type { ContextUsage, PromptAttachment } from "@/shared/ipc";
import { AttachmentRow } from "./attachment-row";
import { ContextMeter } from "./context-meter";
import { useStudio } from "./studio-provider";

const DEFAULT = "";

const MODELS = [
  { label: "Default", value: DEFAULT },
  { label: "Opus 5", value: "claude-opus-5" },
  { label: "Sonnet 5", value: "claude-sonnet-5" },
  { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

const EFFORTS = [
  { label: "Default", value: DEFAULT },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra high", value: "xhigh" },
  { label: "Max", value: "max" },
];

export function Composer({
  context,
  disabled,
  isRunning,
  onStop,
  onSubmit,
}: {
  context: ContextUsage | null;
  disabled: boolean;
  isRunning: boolean;
  onStop: () => void;
  onSubmit: (text: string, attachments: readonly PromptAttachment[]) => void;
}) {
  const { claudeEffort, claudeModel, onEffortChange, onModelChange } =
    useStudio();
  const composer = useComposer(onSubmit);
  const sidecar = useSidecar();
  const cannotSend = disabled || sidecar.phase === "down";

  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-1">
        <InputGroup>
          {composer.attachments.items.length > 0 ? (
            <InputGroupAddon align="block-start">
              <AttachmentRow
                items={composer.attachments.items}
                onRemove={composer.attachments.onRemove}
              />
            </InputGroupAddon>
          ) : null}

          <InputGroupTextarea
            aria-label="Message Claude"
            disabled={disabled}
            onChange={composer.onChange}
            onKeyDown={composer.onKeyDown}
            placeholder="Describe the scene you want to build…"
            rows={2}
            value={composer.value}
          />

          <InputGroupAddon align="block-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <InputGroupButton
                    aria-label="Add to this message"
                    disabled={disabled}
                    size="icon-xs"
                    variant="ghost"
                  />
                }
              >
                <PlusIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={composer.attachments.add}>
                    <ImagePlusIcon />
                    Add image
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="ml-auto flex items-center gap-1">
              {context === null ? null : <ContextMeter usage={context} />}

              <MenuChip
                icon={SparklesIcon}
                items={MODELS}
                label={labelOf(MODELS, claudeModel)}
                onChange={onModelChange}
                title="Model"
                value={claudeModel}
              />

              <MenuChip
                icon={SettingsIcon}
                items={EFFORTS}
                label={labelOf(EFFORTS, claudeEffort)}
                onChange={onEffortChange}
                title="Effort"
                value={claudeEffort}
              />

              {isRunning ? (
                <InputGroupButton
                  onClick={onStop}
                  size="icon-sm"
                  variant="outline"
                >
                  <SquareIcon />
                  <span className="sr-only">Stop</span>
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  disabled={cannotSend || !composer.canSubmit}
                  onClick={composer.submit}
                  size="icon-sm"
                  variant="default"
                >
                  <ArrowUpIcon />
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              )}
            </div>
          </InputGroupAddon>
        </InputGroup>

        <p
          className="flex min-h-5 items-center px-3 text-muted-foreground text-xs"
          role="status"
        >
          <ComposerStatus
            error={composer.attachments.error}
            sidecar={sidecar}
          />
        </p>
      </div>
    </div>
  );
}

function MenuChip({
  icon: Icon,
  items,
  label,
  onChange,
  title,
  value,
}: {
  icon: typeof SparklesIcon;
  items: { label: string; value: string }[];
  label: string;
  onChange: (value: string) => void;
  title: string;
  value: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton aria-label={`${title}: ${label}`} variant="ghost" />
        }
      >
        <Icon />
        {label}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={onChange}
            value={value ?? DEFAULT}
          >
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function labelOf(
  items: { label: string; value: string }[],
  value: string | null
): string {
  const found = items.find((item) => item.value === (value ?? DEFAULT));
  return found?.label ?? value ?? "Default";
}

function ComposerStatus({
  error,
  sidecar,
}: {
  error: string | null;
  sidecar: Sidecar;
}) {
  if (error !== null) {
    return <span className="text-destructive">{error}</span>;
  }

  if (sidecar.phase === "down") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        The sidecar is not running.
        <Button
          className="h-auto p-0 text-destructive text-xs"
          onClick={sidecar.restart}
          size="xs"
          variant="link"
        >
          Restart it
        </Button>
      </span>
    );
  }

  if (sidecar.phase === "starting" || sidecar.phase === "restarting") {
    return (
      <span className="flex items-center gap-2">
        <Spinner className="size-3" />
        Starting the sidecar…
      </span>
    );
  }

  return null;
}
