import { statusOf, type TurnState } from "@/lib/studio/turns";

export type MoodTone = "failed" | "idle" | "waiting";

export interface ShellMood {
  isBusy: boolean;
  tone: MoodTone;
}

export function shellMood(turns: ReadonlyMap<string, TurnState>): ShellMood {
  let tone: MoodTone = "idle";
  let isBusy = false;

  for (const turn of turns.values()) {
    const status = statusOf(turn);

    if (status === "running") {
      isBusy = true;
    }
    if (status === "waiting") {
      tone = "waiting";
    }
    if (status === "failed" && tone !== "waiting") {
      tone = "failed";
    }
  }

  return { isBusy, tone };
}
