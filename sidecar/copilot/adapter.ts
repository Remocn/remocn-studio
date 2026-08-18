import { Effect } from "effect";
import type { EffortLevel, PromptParams, PromptResult } from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { acpTurn } from "../acp/turn";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { accountCheck, missingRow } from "./account";
import { findCopilot } from "./cli";
import { failureFromText, inBandFailure } from "./failure";

// Copilot's --effort accepts a superset of the studio's levels, so the map
// is the identity.
const EFFORTS: Record<EffortLevel, string> = {
  high: "high",
  low: "low",
  max: "max",
  medium: "medium",
  xhigh: "xhigh",
};

export const copilotAdapter: AgentAdapter = {
  account: () => accountCheck(),

  info: PROVIDER_INFO.copilot,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.suspend(() => {
      const executable = findCopilot();
      if (executable === null) {
        return Effect.succeed({
          context: null,
          failure: {
            kind: "unknown",
            message: missingRow().detail ?? "Copilot is not installed.",
          },
          sessionId: params.sessionId,
        } satisfies PromptResult);
      }

      return acpTurn(
        {
          args: [
            "--acp",
            "--log-level",
            "none",
            "--no-auto-update",
            "--no-remote",
            ...(params.effort === null
              ? []
              : ["--effort", EFFORTS[params.effort]]),
            ...(params.model === null || params.model.length === 0
              ? []
              : ["--model", params.model]),
          ],
          classify: failureFromText,
          command: executable,
          images: true,
          inBand: inBandFailure,
        },
        params,
        services
      );
    }),
};
