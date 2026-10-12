"use client";

import { useCallback } from "react";
import { Music2Icon, Volume2Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSoundPrompt } from "@/hooks/use-sound-prompt";
import { useStudio, useStudioComposer, useStudioTurn } from "./studio-provider";

export function SoundPrompt({ disabled }: { disabled: boolean }) {
  const { settingsView } = useStudio();
  const composer = useStudioComposer();
  const turn = useStudioTurn();
  const prompt = useSoundPrompt(
    composer,
    settingsView,
    disabled || turn.permission !== null || turn.source !== null,
    turn
  );
  const onSound = useCallback(() => prompt.onClick("sound"), [prompt.onClick]);
  const onMusic = useCallback(() => prompt.onClick("music"), [prompt.onClick]);
  if (!prompt.visible || composer.value.trim().length > 0) {
    return null;
  }
  return (
    <div className="shrink-0 pb-2">
      <div className="flex w-full flex-col items-start gap-1">
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="Generate sound"
            disabled={prompt.pending}
            onClick={onSound}
            size="sm"
            type="button"
            variant="outline"
          >
            {prompt.pending ? <Spinner /> : <Volume2Icon />}
            Generate sound
          </Button>
          <Button
            aria-label="Generate music"
            disabled={prompt.pending}
            onClick={onMusic}
            size="sm"
            type="button"
            variant="outline"
          >
            {prompt.pending ? <Spinner /> : <Music2Icon />}
            Generate music
          </Button>
        </div>
        {prompt.error === null ? null : (
          <p className="text-destructive text-xs" role="alert">
            {prompt.error}
          </p>
        )}
      </div>
    </div>
  );
}
