import { Effect, Exit, Ref } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  AgentEvent,
  AgentFailure,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";
import type { TurnServices } from "../agent/adapter";
import { announce, type KnowledgeBundle } from "../agent/knowledge";
import { elementsOf } from "../agent/prompt";
import type { AcpPeer } from "./connection";
import { type AcpBlock, blocksOf } from "./content";
import { makeAcpTranslator } from "./events";
import { switchMode, takeModeUpdate } from "./mode";
import { answerPermission } from "./permission";
import { acpPool, type Held, type SessionModes } from "./pool";

// One turn over the Agent Client Protocol, shared by every adapter that
// speaks it: what varies per provider is only how the process is started,
// whether it can look at images, and how its failures are worded.
export interface AcpTurnConfig {
  readonly args: readonly string[];
  readonly classify: (text: string) => AgentFailure;
  readonly command: string;
  readonly images: boolean;
  readonly inBand: (firstChunk: string) => AgentFailure | null;
  readonly knowledge: KnowledgeBundle;
}

interface OpenedSession {
  modes?: SessionModes;
  sessionId?: string;
}

export function acpTurn(
  config: AcpTurnConfig,
  params: PromptParams,
  services: TurnServices
): Effect.Effect<PromptResult> {
  return Effect.gen(function* () {
    const failure = yield* Ref.make<AgentFailure | null>(null);
    const opened = { sessionId: params.sessionId };
    const translator = makeAcpTranslator();

    yield* announce(config.knowledge, services);

    let replaying = false;
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
      if (method !== "session/update") {
        return;
      }

      const { update } = raw as { update?: Record<string, unknown> };
      if (update === undefined) {
        return;
      }

      takeModeUpdate(held, update);
      if (update.sessionUpdate === "current_mode_update" || replaying) {
        return;
      }

      if (firstChunk && update.sessionUpdate === "agent_message_chunk") {
        firstChunk = false;
        const text =
          (update.content as { text?: string } | undefined)?.text ?? "";
        const inBand = config.inBand(text);
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
          { cwd: services.cwd, permissions: services.permissions },
          raw as never
        );
      }

      return Promise.reject(new Error(`the studio does not answer ${method}`));
    };

    const { fresh, held } = yield* Effect.acquireRelease(
      acpPool.checkout(
        params.historyId,
        {
          args: config.args,
          command: config.command,
          cwd: services.cwd,
          log: (line) => Effect.runSync(services.log(line)),
        },
        params.sessionId
      ),
      (checkout, exit) =>
        Effect.andThen(
          services.permissions.abandon,
          Effect.flatMap(Ref.get(failure), (failed) =>
            giveBack(
              params.historyId,
              checkout.held,
              Exit.isSuccess(exit) && failed === null,
              opened.sessionId
            )
          )
        )
    );

    replaying = fresh && params.sessionId !== null;
    held.bind({ onNotification, onRequest });

    yield* Effect.tryPromise({
      catch: (cause) => new Error(errorMessage(cause)),
      try: () => run(held.peer),
    }).pipe(
      Effect.tap(() => Effect.promise(() => delivering)),
      Effect.catch((error) =>
        Ref.update(
          failure,
          (current) => current ?? config.classify(error.message)
        )
      )
    );

    return {
      context: null,
      failure: yield* Ref.get(failure),
      sessionId: opened.sessionId,
    } satisfies PromptResult;

    async function run(agent: AcpPeer): Promise<void> {
      const session: OpenedSession = fresh
        ? await open(agent)
        : { modes: held.modes };
      if (!fresh) {
        opened.sessionId = held.sessionId;
      }
      held.modes = session.modes;
      replaying = false;

      const { sessionId } = opened;
      if (sessionId === null) {
        throw new Error("The agent opened no session to speak in.");
      }

      deliver([
        {
          mode: params.mode,
          model: "",
          sessionId,
          type: "session",
        },
      ]);

      const log = (line: string) => Effect.runSync(services.log(line));
      await switchMode(agent, sessionId, params.mode, held, log);
      Effect.runSync(
        services.onMode(async (mode) => {
          if (!(await switchMode(agent, sessionId, mode, held, log))) {
            throw new Error(`the agent did not enter ${mode}`);
          }
        })
      );

      if (!config.images && params.attachments.length > 0) {
        deliver([
          {
            message:
              "This provider cannot look at images, so the attached pictures were not sent.",
            type: "notice",
          },
        ]);
      }

      const answered = await agent.request<{ stopReason?: string }>(
        "session/prompt",
        { prompt: await promptOf(), sessionId }
      );

      if (answered.stopReason === "refusal") {
        throw new Error("The agent refused to answer this prompt.");
      }
    }

    async function promptOf(): Promise<AcpBlock[]> {
      const { media, system, trailer } = services.instructions(
        config.knowledge.loaded
      );

      const blocks = config.images
        ? await blocksOf(params, trailer, media)
        : textOnly(params, trailer, media);

      return [{ text: system, type: "text" }, ...blocks];
    }

    async function open(agent: AcpPeer): Promise<OpenedSession> {
      await agent.request("initialize", {
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
        },
        protocolVersion: 1,
      });

      const mcpServers = Object.entries(services.tools).map(
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

      if (params.sessionId === null) {
        const session = await agent.request<OpenedSession>("session/new", {
          cwd: services.cwd,
          mcpServers,
        });
        opened.sessionId = session.sessionId ?? null;
        return session;
      }

      const session = await agent.request<OpenedSession>("session/load", {
        cwd: services.cwd,
        mcpServers,
        sessionId: params.sessionId,
      });
      opened.sessionId = params.sessionId;
      return session;
    }
  }).pipe(Effect.scoped);
}

function giveBack(
  chat: string,
  held: Held,
  clean: boolean,
  sessionId: string | null
): Effect.Effect<void> {
  if (clean && sessionId !== null) {
    held.sessionId = sessionId;
    return acpPool.checkin(chat, held);
  }
  return Effect.suspend(() => {
    if (sessionId !== null) {
      held.peer.notify("session/cancel", { sessionId });
    }
    return acpPool.discard(chat, held);
  });
}

function textOnly(
  params: PromptParams,
  ...appended: readonly (string | null)[]
): { text: string; type: "text" }[] {
  const blocks: { text: string; type: "text" }[] = [
    { text: params.prompt, type: "text" },
  ];

  for (const trailer of [elementsOf(params.elements), ...appended]) {
    if (trailer !== null) {
      blocks.push({ text: trailer, type: "text" });
    }
  }

  return blocks;
}
