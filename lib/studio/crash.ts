import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import {
  type CrashDecision,
  crashDecision,
  crashRelease,
  scrub,
} from "@/shared/crash";
import type { AppEnvironment } from "@/shared/ipc";

/**
 * Baked in by Next at build time, exactly as the Pexels key is baked into the
 * sidecar bundle. Absent until a Sentry project exists, and absent reads the
 * same as consent withheld — nothing starts.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? null;

/**
 * The webview cannot ask the operating system where home is, so the scrubber
 * runs on its pattern rule alone. That is enough for the platforms this ships
 * on: every macOS home is under `/Users/<name>` and every Linux home under
 * `/home/<name>`, which the rule rewrites.
 */
const NO_KNOWN_HOME: string | null = null;

export interface CrashBuild {
  environment: AppEnvironment | null;
  version: string | null;
}

// Consent is read here rather than only at init, and that is what makes
// withdrawing it airtight. `Sentry.close()` settles the transport but says
// nothing about an event already on its way to it; a `beforeSend` that
// answers `null` drops the event before it is ever queued.
let consented = false;
let started = false;
let initialised = false;
let sdk: Promise<typeof import("@sentry/react")> | null = null;

function loadSdk() {
  sdk ??= import("@sentry/react");
  return sdk;
}

export function isCrashReportingStarted(): boolean {
  return started;
}

/**
 * Starts, stops, or leaves the SDK alone. Idempotent, so the hook that owns it
 * can call it on every settings change without tracking what it did last.
 *
 * The SDK is never initialised without consent — not initialised-and-silent.
 * An app whose promise is that nothing reaches a third party cannot have a
 * reporter sitting in memory waiting to be switched on.
 */
export function applyCrashConsent(input: {
  build: CrashBuild;
  consent: boolean;
}): CrashDecision {
  const { environment, version } = input.build;

  const decision = crashDecision({
    consent: input.consent,
    dsn: DSN,
    environment,
  });

  consented = decision.started;

  // `crashDecision` has already refused a null DSN and a non-production
  // environment; the guards here are what let the compiler see it, and a
  // production build always answers with a version beside its environment.
  if (
    decision.started &&
    DSN !== null &&
    environment !== null &&
    version !== null
  ) {
    if (!started) {
      started = true;
      start({ dsn: DSN, environment, version });
    }
    return decision;
  }

  if (started) {
    started = false;
    // Zero, not the default two seconds: a person who has just withdrawn
    // consent must not have the app pause to finish sending what it had.
    // `consented` is already false, so nothing new can be captured either.
    loadSdk()
      .then((sentry) => {
        initialised = false;
        return sentry.close(0);
      })
      .catch(() => undefined);
  }

  return decision;
}

/**
 * `@remotion/webcodecs` aborts its own controller when a conversion fails, and
 * the frames already on their way through it then throw this from promises the
 * library never awaits. The failure that caused the abort has by then rejected
 * `convertMedia` and been handled by its caller, so what reaches the global
 * handler is an echo of an expected failure, not a crash. Matched by name, as
 * media-parser's own `hasBeenAborted` does, so the check costs no import of the
 * 1.4MB chunk it lives in.
 */
export function isStrayAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "MediaParserAbortError";
}

export function reportRenderCrash(error: unknown, componentStack: string) {
  if (!(started && consented)) {
    return;
  }
  loadSdk()
    .then((sentry) => {
      if (initialised) {
        sentry.captureException(error, {
          contexts: { react: { componentStack } },
        });
      }
    })
    .catch(() => undefined);
}

function start(input: {
  dsn: string;
  environment: AppEnvironment;
  version: string;
}) {
  loadSdk()
    .then((sentry) => {
      if (started && !initialised) {
        initialised = true;
        init(sentry, input);
      }
    })
    .catch(() => undefined);
}

function init(
  sentry: typeof import("@sentry/react"),
  input: { dsn: string; environment: AppEnvironment; version: string }
) {
  sentry.init({
    // A breadcrumb trail is the one part of an event that records what the
    // person was doing rather than what broke, and the console is where a
    // prompt would end up. Crashes only, in v1.
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) =>
      consented && !isStrayAbort(hint.originalException)
        ? scrub(event, NO_KNOWN_HOME)
        : null,
    dsn: input.dsn,
    environment: input.environment,
    // The default set carries the breadcrumb collectors and a session ping;
    // what is kept is what turns an exception into a readable stack, and
    // nothing that watches the person use the app.
    integrations: [
      sentry.dedupeIntegration(),
      sentry.eventFiltersIntegration(),
      sentry.functionToStringIntegration(),
      sentry.linkedErrorsIntegration(),
    ],
    maxBreadcrumbs: 0,
    release: crashRelease(input.version),
    // Off, and it is not tidiness: a client report is Sentry's telemetry about
    // its own telemetry — "one event was discarded, reason before_send" — and
    // it is sent even when every event was dropped. Withdrawing consent left
    // the process still making one request to Sentry, which was measured with
    // `bun run crash:verify` and is the wrong answer for an app whose promise
    // is that nothing reaches a third party.
    sendClientReports: false,
    sendDefaultPii: false,
    // Crashes, not performance. Tracing would sample ordinary turns and carry
    // their timings and URLs out with them.
    tracesSampleRate: 0,
  });
}

/**
 * The live half of the consent, for the sidecar. Rust already told it what
 * `settings.json` said at spawn; this is what makes the switch take effect
 * without waiting for a relaunch. Answers what the sidecar is *actually*
 * doing, which a build with no DSN reports as `false` however the switch is
 * set.
 */
export function tellSidecarConsent(
  enabled: boolean
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "crash.consent",
      params: { enabled },
    });

    return answer.reporting;
  });
}
