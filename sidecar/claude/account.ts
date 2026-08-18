import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { EnvironmentCheck } from "@/shared/ipc";
import { NOT_AUTHENTICATED } from "./failure";

export class AccountError extends Data.TaggedError("AccountError")<{
  message: string;
}> {}

const ACCOUNT_TIMEOUT = "30 seconds";
const LOGGED_OUT = "none";
const FIRST_PARTY = "firstParty";

export interface Account {
  apiProvider?: string;
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
}

export function accountRow(account: Account): EnvironmentCheck {
  const provider = account.apiProvider ?? FIRST_PARTY;

  if (provider !== FIRST_PARTY) {
    return {
      detail: `Authenticated through ${provider}.`,
      fix: null,
      id: "claude",
      state: "ok",
      title: "Claude Code is authenticated",
    };
  }

  if (account.tokenSource === LOGGED_OUT) {
    return {
      detail: NOT_AUTHENTICATED,
      fix: { command: "claude", type: "command" },
      id: "claude",
      state: "failed",
      title: "Claude Code is not logged in",
    };
  }

  return {
    detail: account.subscriptionType ?? account.email ?? null,
    fix: null,
    id: "claude",
    state: "ok",
    title: "Claude Code is logged in",
  };
}

export function unreachableRow(message: string): EnvironmentCheck {
  return {
    detail: `${message}\n\nRun claude in a terminal to see what it says.`,
    fix: { command: "claude", type: "command" },
    id: "claude",
    state: "failed",
    title: "Claude Code could not start",
  };
}

function silent(closed: Promise<void>): AsyncIterable<SDKUserMessage> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        await closed;
        return { done: true, value: undefined };
      },
    }),
  };
}

export function askAccount(cwd: string): Effect.Effect<Account, AccountError> {
  return Effect.tryPromise({
    catch: (cause) => new AccountError({ message: errorMessage(cause) }),
    try: async () => {
      const input = Promise.withResolvers<void>();
      const session = query({
        options: { cwd },
        prompt: silent(input.promise),
      });

      try {
        return (await session.accountInfo()) as Account;
      } finally {
        input.resolve();
      }
    },
  }).pipe(
    Effect.timeout(ACCOUNT_TIMEOUT),
    Effect.catch((cause) =>
      Effect.fail(
        cause instanceof AccountError
          ? cause
          : new AccountError({
              message: `Claude Code did not answer within ${ACCOUNT_TIMEOUT}.`,
            })
      )
    )
  );
}

export function accountCheck(cwd: string): Effect.Effect<EnvironmentCheck> {
  return askAccount(cwd).pipe(
    Effect.map(accountRow),
    Effect.catch((error) => Effect.succeed(unreachableRow(error.message)))
  );
}
