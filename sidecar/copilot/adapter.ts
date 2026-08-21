import { Effect } from "effect";
import type { EffortLevel, PromptParams, PromptResult } from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { acpTurn } from "../acp/turn";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { type KnowledgeBundle, locateBundle } from "../agent/knowledge";
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

// The bundle travels as a plugin directory, resolved from the shipped
// resource rather than from the project: Copilot reads `<dir>/skills/*/SKILL.md`
// off the plugin's own manifest, so nothing is copied anywhere. `copilot skill
// list` does not report --plugin-dir plugins — measured against 1.0.80, that
// command hands its own loader no external plugins — but an ACP session does.
export function copilotArgs(
  params: PromptParams,
  knowledge: KnowledgeBundle
): readonly string[] {
  return [
    "--acp",
    "--log-level",
    "none",
    "--no-auto-update",
    "--no-remote",
    ...(knowledge.path === null ? [] : ["--plugin-dir", knowledge.path]),
    ...(params.effort === null ? [] : ["--effort", EFFORTS[params.effort]]),
    ...(params.model === null || params.model.length === 0
      ? []
      : ["--model", params.model]),
  ];
}

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

      const knowledge = locateBundle(services.cwd);

      return acpTurn(
        {
          args: copilotArgs(params, knowledge),
          classify: failureFromText,
          command: executable,
          images: true,
          inBand: inBandFailure,
          knowledge,
        },
        params,
        services
      );
    }),
};
