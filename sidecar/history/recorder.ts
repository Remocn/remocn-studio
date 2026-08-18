import { Effect, Ref } from "effect";
import type {
  AgentEvent,
  HistorySession,
  PromptParams,
  TranscriptEntry,
} from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";
import type { HistoryError, HistoryStore } from "./store";

const TITLE_LIMIT = 60;
const WHITESPACE = /\s+/g;

export interface Recorder {
  readonly event: (event: AgentEvent) => Effect.Effect<void>;
  readonly session: HistorySession | null;
}

const INERT: Recorder = { event: () => Effect.void, session: null };

export function recording(
  store: HistoryStore,
  params: PromptParams,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<Recorder> {
  const tolerate = <A>(effect: Effect.Effect<A, HistoryError>) =>
    effect.pipe(
      Effect.catch((error) =>
        log(`history: ${error.message}`).pipe(Effect.as(null))
      )
    );

  return Effect.gen(function* () {
    const session = yield* tolerate(
      store.open({
        id: params.historyId,
        mode: params.mode,
        projectId: params.projectId,
        provider: params.provider,
        title: titleOf(params),
      })
    );
    if (session === null) {
      return INERT;
    }

    const base = yield* tolerate(store.nextOrdinal(session.id));
    if (base === null) {
      return INERT;
    }

    const entries = yield* Ref.make<readonly TranscriptEntry[]>([]);

    const apply = (
      step: (current: readonly TranscriptEntry[]) => readonly TranscriptEntry[]
    ) =>
      Effect.gen(function* () {
        const previous = yield* Ref.get(entries);
        const next = step(previous);
        yield* Ref.set(entries, next);

        yield* tolerate(
          Effect.forEach(
            changed(previous, next),
            (index) =>
              store.write({
                entry: next[index],
                ordinal: base + index,
                sessionId: session.id,
              }),
            { discard: true }
          )
        );
      });

    yield* apply((current) =>
      appendUser(current, {
        assets: params.assets,
        attachments: params.attachments,
        elements: params.elements,
        media: params.media,
        text: params.prompt,
      })
    );

    return {
      event: (event) =>
        event.type === "session"
          ? Effect.asVoid(tolerate(store.bind(session.id, event.sessionId)))
          : apply((current) => fold(current, event)),
      session,
    };
  });
}

function changed(
  previous: readonly TranscriptEntry[],
  next: readonly TranscriptEntry[]
): number[] {
  const indices: number[] = [];
  for (const [index, entry] of next.entries()) {
    if (entry !== previous[index]) {
      indices.push(index);
    }
  }
  return indices;
}

function titleOf(params: PromptParams): string {
  const flat = params.prompt.replace(WHITESPACE, " ").trim();

  if (flat.length === 0) {
    return params.attachments.at(0)?.name ?? "Untitled session";
  }

  return flat.length <= TITLE_LIMIT
    ? flat
    : `${flat.slice(0, TITLE_LIMIT - 1).trimEnd()}…`;
}
