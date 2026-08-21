import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type { AgentEvent } from "@/shared/ipc";
import { PLUGIN_DIR_ENV } from "@/shared/ipc";

export const INTERACTIVITY_SKILL = "remotion-interactivity";

export const VENDORED = [
  "remocn",
  "remotion-best-practices",
  INTERACTIVITY_SKILL,
] as const;

export const LESSONS_SKILL = "video-lessons";

export const MOTION_SKILL = "motion-design";

export const SHIPPED = [...VENDORED, LESSONS_SKILL, MOTION_SKILL] as const;

export const BUNDLE_NAME = "remocn-studio";

export const CLAUDE_MANIFEST = join(".claude-plugin", "plugin.json");

export const CODEX_MARKETPLACE = join(".agents", "plugins", "marketplace.json");

// How the bundle reached the runtime, not which provider asked: `plugin-dir`
// is the flag Claude, Copilot and Grok all take, `codex-home` is the mirrored
// home Codex needs because its CLI reads plugins only from a user config
// layer.
export type BundleSource = "codex-home" | "none" | "plugin-dir";

// The attach contract. It is answered per turn and never inferred from the
// provider's name: an adapter asks for skill-aware conventions because this
// says `loaded`, not because of who it is.
export interface KnowledgeBundle {
  readonly collisions: readonly string[];
  readonly loaded: boolean;
  readonly path: string | null;
  readonly reason: string | null;
  readonly source: BundleSource;
}

export function noBundle(reason: string): KnowledgeBundle {
  return {
    collisions: [],
    loaded: false,
    path: null,
    reason,
    source: "none",
  };
}

export function locateBundle(cwd: string): KnowledgeBundle {
  const dir = process.env[PLUGIN_DIR_ENV];

  if (dir === undefined || dir.length === 0 || !existsSync(dir)) {
    return noBundle("the app shipped no skills bundle");
  }

  const broken = invalidIn(dir);
  if (broken !== null) {
    return noBundle(broken);
  }

  return {
    collisions: collisionsIn(cwd),
    loaded: true,
    path: dir,
    reason: null,
    source: "plugin-dir",
  };
}

// A skill the project installed itself keeps its own copy by each runtime's
// precedence, and it is recorded rather than acted on: dropping the bundle
// over one name would take the other four with it.
export function collisionsIn(cwd: string): readonly string[] {
  return VENDORED.filter((skill) =>
    existsSync(join(cwd, ".claude", "skills", skill))
  );
}

export function bundleVersion(dir: string): string {
  try {
    const manifest = JSON.parse(
      readFileSync(join(dir, CLAUDE_MANIFEST), "utf8")
    ) as { version?: unknown };

    return typeof manifest.version === "string" && manifest.version.length > 0
      ? manifest.version
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function knowledgeNotice(bundle: KnowledgeBundle): AgentEvent | null {
  if (bundle.loaded || bundle.reason === null) {
    return null;
  }

  return {
    message: `The studio's bundled skills were not loaded for this turn — ${bundle.reason}. The turn runs on the studio conventions alone.`,
    type: "notice",
  };
}

// Every adapter says the same thing about its own attach, and says it the
// same way: the reason goes to the log whatever happened, and a bundle that
// should have loaded and did not also becomes one notice. A skills failure is
// never dressed up as an auth or model failure — the turn runs either way.
export function announce(
  bundle: KnowledgeBundle,
  services: {
    readonly emit: (event: AgentEvent) => Effect.Effect<void>;
    readonly log: (line: string) => Effect.Effect<void>;
  }
): Effect.Effect<void> {
  const lines = [
    bundle.loaded
      ? `knowledge: bundled skills loaded from ${bundle.source} (${bundle.path})`
      : `knowledge: bundled skills not loaded — ${bundle.reason}`,
    ...(bundle.collisions.length === 0
      ? []
      : [
          `knowledge: the project ships its own ${bundle.collisions.join(", ")}, which wins by the runtime's own precedence; the rest of the bundle still loaded`,
        ]),
  ];

  const notice = knowledgeNotice(bundle);

  return Effect.forEach(lines, services.log, { discard: true }).pipe(
    Effect.andThen(notice === null ? Effect.void : services.emit(notice))
  );
}

function invalidIn(dir: string): string | null {
  if (!existsSync(join(dir, CLAUDE_MANIFEST))) {
    return `the bundle at ${dir} carries no ${CLAUDE_MANIFEST}`;
  }

  const missing = SHIPPED.filter(
    (skill) => !existsSync(join(dir, "skills", skill, "SKILL.md"))
  );

  return missing.length === 0
    ? null
    : `the bundle at ${dir} is missing ${missing.join(", ")}`;
}
