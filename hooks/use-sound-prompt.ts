"use client";

import { useCallback, useRef, useState } from "react";
import { readConnections } from "@/lib/studio/integrations";
import { hasCapability } from "@/shared/integrations";
import { useAsyncAction } from "./use-async-action";
import type { Composer } from "./use-composer";
import type { OpenTurn } from "./use-open-turn";
import type { SettingsView } from "./use-settings-view";

export function useSoundPrompt(
  composer: Composer,
  settings: SettingsView,
  disabled: boolean,
  turn: Pick<OpenTurn, "entries" | "isRunning" | "isLoadingTranscript">
) {
  const visible =
    !(disabled || turn.isRunning || turn.isLoadingTranscript) &&
    turn.entries.some(
      (entry) => entry.kind === "assistant" && entry.text.trim().length > 0
    );
  const { error, run } = useAsyncAction();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const latest = useRef({ composer, disabled: !visible, settings });
  latest.current = { composer, disabled: !visible, settings };

  const onClick = useCallback(
    async (kind: "music" | "sound" = "sound") => {
      if (busy.current || latest.current.disabled) {
        return;
      }
      busy.current = true;
      setPending(true);
      const field = latest.current.composer.caret.ref.current;
      const connections = await run(readConnections);
      busy.current = false;
      setPending(false);
      const { current } = latest;
      if (
        connections === null ||
        current.disabled ||
        field === null ||
        !field.isConnected ||
        field !== current.composer.caret.ref.current ||
        field.value.trim().length > 0
      ) {
        return;
      }
      if (
        connections.some(
          (connection) =>
            ["elevenlabs", "openrouter"].includes(connection.provider) &&
            hasCapability(connection, "audio")
        )
      ) {
        current.composer.write(
          kind === "music"
            ? "Generate instrumental music:"
            : "Generate a sound effect:"
        );
        return;
      }
      current.settings.setSection("integrations");
      current.settings.open();
    },
    [run]
  );

  return { error, onClick, pending, visible };
}
