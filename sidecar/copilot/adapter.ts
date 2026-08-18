import { Effect, Ref } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  AgentEvent,
  AgentFailure,
  EffortLevel,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { type AcpPeer, spawnAcp } from "../acp/connection";
import { blocksOf } from "../acp/content";
import { makeAcpTranslator } from "../acp/events";
import { answerPermission } from "../acp/permission";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { conventionsFor } from "../claude/conventions";
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

// ACP mode ids are URIs; the match is by fragment so a version bump that
// moves the prefix cannot silently strand every session in the default
// mode. acceptEdits maps to plain agent mode — autopilot is Copilot's
// allow-all and has no story here, exactly like bypassPermissions.
const MODE_FRAGMENTS: Record<SessionMode, string> = {
  acceptEdits: "agent",
  auto: "agent",
  plan: "plan",
};

interface OpenedSession {
  modes?: {
    availableModes?: readonly { id?: string; name?: string }[];
    currentModeId?: string;
  };
  sessionId?: string;
}

export const copilotAdapter: AgentAdapter = {
  account: () => accountCheck(),

  info: PROVIDER_INFO.copilot,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.gen(function* () {
      const executable = findCopilot();
      if (executable === null) {
        return {
          context: null,
          failure: {
            kind: "unknown",
            message: missingRow().detail ?? "Copilot is not installed.",
          },
          sessionId: params.sessionId,
        } satisfies PromptResult;
      }

      const failure = yield* Ref.make<AgentFailure | null>(null);
      const opened = { sessionId: params.sessionId };
      const translator = makeAcpTranslator();

      let replaying = params.sessionId !== null;
      let firstChunk = true;
      let delivering: Promise<void> = Promise.resolve();

      const deliver = (events: readonly AgentEvent[]) => {
        for (const event of events) {
          delivering = delivering.then(() =>
            Effect.runPromise(
              Effect.andThen(services.emit(event), services.record(event))
            )
          );
        }
      };

      const onNotification = (method: string, raw: unknown) => {
        if (method !== "session/update" || replaying) {
          return;
        }

        const { update } = raw as { update?: Record<string, unknown> };
        if (update === undefined) {
          return;
        }

        if (firstChunk && update.sessionUpdate === "agent_message_chunk") {
          firstChunk = false;
          const text =
            (update.content as { text?: string } | undefined)?.text ?? "";
          const inBand = inBandFailure(text);
          if (inBand !== null) {
            Effect.runSync(Ref.set(failure, inBand));
            return;
          }
        }

        deliver(translator.take(update));
      };

      const onRequest = (method: string, raw: unknown) => {
        if (method === "session/request_permission") {
          return answerPermission(
            {
              cwd: services.cwd,
              emit: services.emit,
              gate: services.gate,
              turnId: services.turnId,
            },
            raw as never
          );
        }

        return Promise.reject(
          new Error(`the studio does not answer ${method}`)
        );
      };

      const peer = yield* Effect.acquireRelease(
        Effect.sync(() =>
          spawnAcp({
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
            command: executable,
            cwd: services.cwd,
            log: (line) => Effect.runSync(services.log(line)),
            onNotification,
            onRequest,
          })
        ),
        (running) =>
          Effect.sync(() => {
            if (typeof opened.sessionId === "string") {
              running.notify("session/cancel", {
                sessionId: opened.sessionId,
              });
            }
            services.gate.abandon(services.turnId).pipe(Effect.runSync);
            running.kill();
          })
      );

      yield* Effect.tryPromise({
        catch: (cause) => new Error(errorMessage(cause)),
        try: () => run(peer, params, services, opened),
      }).pipe(
        Effect.tap(() => Effect.promise(() => delivering)),
        Effect.catch((error) =>
          Ref.update(
            failure,
            (current) => current ?? failureFromText(error.message)
          )
        )
      );

      return {
        context: null,
        failure: yield* Ref.get(failure),
        sessionId: opened.sessionId,
      } satisfies PromptResult;

      async function run(
        agent: AcpPeer,
        prompt: PromptParams,
        turn: TurnServices,
        holder: { sessionId: string | null }
      ): Promise<void> {
        await agent.request("initialize", {
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
          },
          protocolVersion: 1,
        });

        const mcpServers = Object.entries(turn.tools).map(
          ([name, transport]) => ({
            args: [...transport.args],
            command: transport.command,
            env: Object.entries(transport.env).map(([key, value]) => ({
              name: key,
              value,
            })),
            name,
          })
        );

        let session: OpenedSession;
        if (prompt.sessionId === null) {
          session = await agent.request<OpenedSession>("session/new", {
            cwd: turn.cwd,
            mcpServers,
          });
          holder.sessionId = session.sessionId ?? null;
        } else {
          session = await agent.request<OpenedSession>("session/load", {
            cwd: turn.cwd,
            mcpServers,
            sessionId: prompt.sessionId,
          });
          holder.sessionId = prompt.sessionId;
        }
        replaying = false;

        if (holder.sessionId === null) {
          throw new Error("Copilot opened no session to speak in.");
        }

        deliver([
          {
            mode: prompt.mode,
            model: "",
            sessionId: holder.sessionId,
            type: "session",
          },
        ]);

        await enterMode(agent, holder.sessionId, session, prompt.mode);

        const conventions = conventionsFor(false);
        const briefed =
          turn.briefs.pipeline === null
            ? conventions
            : `${conventions}\n\n${turn.briefs.pipeline}`;

        const blocks = await blocksOf(
          prompt,
          turn.briefs.assets,
          turn.briefs.media
        );

        const answered = await agent.request<{ stopReason?: string }>(
          "session/prompt",
          {
            prompt: [{ text: briefed, type: "text" }, ...blocks],
            sessionId: holder.sessionId,
          }
        );

        if (answered.stopReason === "refusal") {
          throw new Error("Copilot refused to answer this prompt.");
        }
      }

      async function enterMode(
        agent: AcpPeer,
        sessionId: string,
        session: OpenedSession,
        mode: SessionMode
      ): Promise<void> {
        const wanted = MODE_FRAGMENTS[mode];
        const available = session.modes?.availableModes ?? [];
        const found = available.find((candidate) =>
          (candidate.id ?? "").toLowerCase().includes(wanted)
        );

        if (
          found?.id === undefined ||
          found.id === session.modes?.currentModeId
        ) {
          return;
        }

        try {
          await agent.request("session/set_mode", {
            modeId: found.id,
            sessionId,
          });
        } catch (cause) {
          Effect.runSync(
            services.log(`copilot: could not enter ${mode}: ${String(cause)}`)
          );
        }
      }
    }).pipe(Effect.scoped),
};
