"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  RotateCcwIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Onboarding } from "@/hooks/use-onboarding";
import { useOnboardingStill } from "@/hooks/use-onboarding-still";
import { useSaveErrorToast } from "@/hooks/use-save-error-toast";
import {
  ONBOARDING_CHAPTERS,
  type OnboardingChapter,
} from "@/lib/studio/onboarding";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-provider";

const ENTER =
  "motion-reduce:translate-none motion-reduce:starting:translate-none duration-base ease-out group-data-[motion=backward]/onboarding:starting:opacity-0 group-data-[motion=forward]/onboarding:starting:opacity-0 group-data-[motion=backward]/onboarding:transition-[opacity,translate] group-data-[motion=forward]/onboarding:transition-[opacity,translate] motion-safe:group-data-[motion=backward]/onboarding:starting:-translate-x-3 motion-safe:group-data-[motion=forward]/onboarding:starting:translate-x-3 motion-reduce:transition-opacity";

function step(position: number) {
  return String(position + 1).padStart(2, "0");
}

export function OnboardingDialog({
  suspended = false,
}: {
  suspended?: boolean;
}) {
  const { onboarding } = useStudio();
  return <OnboardingOverview onboarding={onboarding} suspended={suspended} />;
}

export function OnboardingOverview({
  onboarding,
  suspended = false,
}: {
  onboarding: Onboarding;
  suspended?: boolean;
}) {
  const { chapter, index, onCover } = onboarding;
  useSaveErrorToast(onboarding.saveError, onboarding.retrySave);
  const shown = onboarding.isOpen && !suspended;
  const last = index === ONBOARDING_CHAPTERS.length - 1;
  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={onboarding.onOpenChange}
      open={shown}
    >
      <DialogContent
        aria-describedby={undefined}
        bottomStickOnMobile={false}
        className="group/onboarding @container row-span-3 row-start-1 h-[480px] max-h-[calc(100dvh-2rem)] w-[min(1040px,calc(100vw-2rem))] max-w-none self-center overflow-hidden duration-base ease-out data-[motion=instant]:transition-none data-ending-style:duration-fast motion-reduce:transition-none motion-reduce:sm:data-ending-style:scale-100 motion-reduce:sm:data-starting-style:scale-100"
        closeProps={{
          className: "absolute top-3 end-3 z-20 size-7",
        }}
        data-motion={onboarding.motion}
        onKeyDownCapture={onboarding.onKeyDownCapture}
      >
        <DialogTitle className="sr-only">Explore Studio</DialogTitle>
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {shown && onCover ? <Cover /> : null}
          {shown && !onCover ? (
            <Chapter chapter={chapter} index={index} key={chapter.id} />
          ) : null}
        </div>
        <footer className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 bg-popover px-5 pb-6 sm:px-8">
          <nav
            aria-label="Studio features"
            className="flex items-center gap-1.5"
          >
            {ONBOARDING_CHAPTERS.map((item, position) => (
              <button
                aria-current={
                  !onCover && item.id === chapter.id ? "step" : undefined
                }
                aria-label={`${step(position)} ${item.label}`}
                className="group/segment flex h-8 w-7 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
                key={item.id}
                onClick={onboarding.onChapterClick}
                title={item.label}
                type="button"
                value={item.id}
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors duration-fast",
                    !onCover && position <= index && "bg-muted-foreground",
                    (onCover || position > index) &&
                      "bg-input group-hover/segment:bg-muted-foreground/50"
                  )}
                />
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              className="h-8 text-muted-foreground"
              onClick={onboarding.close}
              size="sm"
              variant="ghost"
            >
              Skip
            </Button>
            {onCover ? null : (
              <Button
                aria-label="Previous chapter"
                className="size-8"
                onClick={onboarding.previous}
                size="icon-sm"
                variant="secondary"
              >
                <ArrowLeftIcon />
              </Button>
            )}
            <Button
              className="h-8"
              onClick={onCover ? onboarding.start : onboarding.next}
              size="sm"
            >
              {onCover ? "Take the tour" : null}
              {!onCover && last ? "Done" : null}
              {onCover || last ? null : "Next"}
              {!onCover && last ? <CheckIcon /> : <ArrowRightIcon />}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Cover() {
  return (
    <section
      aria-label="Welcome"
      className="grid min-h-full @[900px]:grid-cols-[320px_minmax(0,1fr)] items-center gap-6 px-5 pt-12 pb-7 sm:px-8"
    >
      <div className="flex flex-col gap-4">
        <p className="font-medium text-muted-foreground text-xs leading-[18px]">
          Welcome
        </p>
        <h2 className="text-balance font-heading font-semibold text-[28px] leading-[34px]">
          Welcome to Remocn Studio
        </h2>
        <p className="text-pretty text-muted-foreground text-sm leading-5">
          Six things that make it more than a chat. A minute, and you can skip
          any of it.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden rounded-lg bg-black"
      >
        {/* biome-ignore lint/performance/noImgElement: bundled still in a static export */}
        <img
          alt=""
          className="aspect-[1990/1080] w-full object-contain"
          height={1080}
          src="/onboarding/inspect.webp"
          width={1990}
        />
      </div>
    </section>
  );
}

function Chapter({
  chapter,
  index,
}: {
  chapter: OnboardingChapter;
  index: number;
}) {
  return (
    <section
      aria-label={chapter.label}
      className={cn(
        "grid min-h-full @[900px]:grid-cols-[320px_minmax(0,1fr)] items-center gap-6 px-5 pt-12 pb-7 sm:px-8",
        ENTER
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="font-medium text-muted-foreground text-xs tabular-nums leading-[18px]">
          {index + 1} of {ONBOARDING_CHAPTERS.length} · {chapter.label}
        </p>
        <h2 className="text-balance font-heading font-semibold text-[28px] leading-[34px]">
          {chapter.title}
        </h2>
        <p className="text-pretty text-muted-foreground text-sm leading-5">
          {chapter.body}
        </p>
      </div>
      <ChapterStill chapter={chapter} />
    </section>
  );
}

export function ChapterStill({ chapter }: { chapter: OnboardingChapter }) {
  const still = useOnboardingStill();
  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      {/* biome-ignore lint/performance/noImgElement: a bundled file in a static export, which next/image adds nothing to */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction */}
      <img
        alt={`${chapter.label} in Studio`}
        className="aspect-[1990/1080] w-full object-contain"
        height={1080}
        key={still.attempt}
        onError={still.onError}
        src={`/onboarding/${chapter.id}.webp`}
        width={1990}
      />
      {still.failed ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-4 text-center text-white"
          role="alert"
        >
          <p className="text-sm">This picture couldn’t load.</p>
          <Button onClick={still.retry} size="sm" variant="secondary">
            <RotateCcwIcon /> Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
