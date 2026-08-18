import { Effect } from "effect";
import type { EffortLevel, PromptParams, PromptResult } from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { acpTurn } from "../acp/turn";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { accountCheck, missingRow } from "./account";
import { findGrok } from "./cli";
import { failureFromText, inBandFailure } from "./failure";

// Grok's --reasoning-effort is interpreted server-side; the studio's upper
// levels clamp to high rather than gambling on values the CLI does not
// enumerate.
const EFFORTS: Record<EffortLevel, string> = {
  high: "high",
  low: "low",
  max: "high",
  medium: "medium",
  xhigh: "high",
};

export const grokAdapter: AgentAdapter = {
  account: () => accountCheck(),

  info: PROVIDER_INFO.grok,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.suspend(() => {
      const executable = findGrok();
      if (executable === null) {
        return Effect.succeed({
          context: null,
          failure: {
            kind: "unknown",
            message: missingRow().detail ?? "Grok is not installed.",
          },
          sessionId: params.sessionId,
        } satisfies PromptResult);
      }

      return acpTurn(
        {
          args: [
            "agent",
            ...(params.effort === null
              ? []
              : ["--reasoning-effort", EFFORTS[params.effort]]),
            ...(params.model === null || params.model.length === 0
              ? []
              : ["-m", params.model]),
            "stdio",
          ],
          classify: failureFromText,
          command: executable,
          images: false,
          inBand: inBandFailure,
        },
        params,
        services
      );
    }),
};
