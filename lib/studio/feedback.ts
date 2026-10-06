import { openUrl } from "@tauri-apps/plugin-opener";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { currentPlatform, type Platform } from "@/lib/studio/platform";

export class FeedbackError extends Data.TaggedError("FeedbackError")<{
  message: string;
}> {}

export const FEEDBACK_INTAKE_EMAIL = "feedback-6c6be9fb09d6@intake.linear.app";

export interface FeedbackDiagnostics {
  environment: string | null;
  os: string | null;
  provider: string | null;
  version: string | null;
}

export function feedbackMailto(
  diagnostics: FeedbackDiagnostics,
  platform: Platform = currentPlatform()
): string {
  const subject = encodeURIComponent("Remocn Studio feedback");
  const body = encodeURIComponent(
    [
      "What happened, or what would make the studio better?",
      "",
      "",
      "",
      "Screenshots help — attach them to this email before sending.",
      "",
      "---",
      ...diagnosticLines(diagnostics, platform),
    ].join("\n")
  );
  return `mailto:${FEEDBACK_INTAKE_EMAIL}?subject=${subject}&body=${body}`;
}

function diagnosticLines(
  diagnostics: FeedbackDiagnostics,
  platform: Platform
): string[] {
  const lines: string[] = [];
  const build = buildLine(diagnostics);
  if (build !== null) {
    lines.push(build);
  }
  if (diagnostics.os !== null) {
    lines.push(
      platform === "mac"
        ? `macOS ${diagnostics.os}`
        : `System: ${diagnostics.os}`
    );
  }
  if (diagnostics.provider !== null) {
    lines.push(`Agent: ${diagnostics.provider}`);
  }
  return lines;
}

function buildLine({
  environment,
  version,
}: FeedbackDiagnostics): string | null {
  if (version === null && environment === null) {
    return null;
  }
  const name = version === null ? "Remocn Studio" : `Remocn Studio ${version}`;
  return environment === null ? name : `${name} (${environment})`;
}

export function openFeedback(
  diagnostics: FeedbackDiagnostics
): Effect.Effect<void, FeedbackError> {
  return Effect.tryPromise({
    catch: (cause) => new FeedbackError({ message: errorMessage(cause) }),
    try: () => openUrl(feedbackMailto(diagnostics)),
  });
}
