import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import type { ProjectTemplate, TemplateProps } from "@/shared/templates";
import { remotionRootOf } from "../preview/project";
import { copyInto, ScaffoldError, VIDEOS_DIR } from "./template";
import { stampVideoOrigin } from "./video-origin";

export const VIDEO_TEMPLATES = "video-templates";

export const DEFAULT_PROJECTS_DIR = join(homedir(), "Movies", "Remocn Studio");

const MANIFEST = "package.json";
const VIDEO_MODULE = "index.tsx";
const PROPS_SLOT = "__TEMPLATE_PROPS__";
const REMOTION = "remotion";
const SUFFIX_LIMIT = 1000;

interface TemplateSpec {
  readonly dependencies: (remotionVersion: string) => Record<string, string>;
  readonly folder: string;
  readonly slug: string;
}

// The pins the copied composition needs beyond what the project template
// already installs. `@remotion/google-fonts` takes the template's own
// `remotion` version, because Remotion refuses a mix of versions across its
// packages.
export const TEMPLATE_SPECS: Record<ProjectTemplate, TemplateSpec> = {
  "welcome-early-member": {
    dependencies: (remotionVersion) => ({
      "@remotion/google-fonts": remotionVersion,
    }),
    folder: "welcome-early-member",
    slug: "welcome-early-member",
  },
};

export function expandTemplateVideo(
  target: string,
  template: ProjectTemplate,
  props: TemplateProps
): Effect.Effect<string, ScaffoldError> {
  return Effect.suspend(() => {
    const source = process.env[TEMPLATE_DIR_ENV];

    if (source === undefined) {
      return Effect.fail(
        new ScaffoldError({
          message: `${TEMPLATE_DIR_ENV} is not set, so there is no ${template} template to expand`,
        })
      );
    }

    const spec = TEMPLATE_SPECS[template];
    const root = remotionRootOf(target);
    const folder = join(root, "src", VIDEOS_DIR, spec.slug);

    return Effect.tryPromise({
      catch: (cause) => new ScaffoldError({ message: errorMessage(cause) }),
      try: async () => {
        const existing = await access(join(folder, VIDEO_MODULE)).then(
          () => true,
          () => false
        );
        await copyInto(
          join(source, VIDEO_TEMPLATES, spec.folder),
          folder,
          (entry) =>
            entry === VIDEO_MODULE
              ? (content) => stamped(content, props, template)
              : null,
          () => false
        );
        if (!existing) {
          await stampVideoOrigin(folder);
        }
        await addDependencies(root, spec);
        return spec.slug;
      },
    });
  });
}

export function stamped(
  content: string,
  props: TemplateProps,
  template: ProjectTemplate
): string {
  if (!content.includes(PROPS_SLOT)) {
    throw new Error(
      `the ${template} template no longer carries ${PROPS_SLOT}, so its props could not be written into it`
    );
  }

  return content.replace(PROPS_SLOT, JSON.stringify(props, null, 2));
}

export function withDependencies(
  manifest: string,
  dependencies: Record<string, string>
): string {
  const parsed = JSON.parse(manifest) as {
    dependencies?: Record<string, string>;
  };
  const merged = { ...dependencies, ...(parsed.dependencies ?? {}) };

  return `${JSON.stringify({ ...parsed, dependencies: merged }, null, 2)}\n`;
}

async function addDependencies(root: string, spec: TemplateSpec) {
  const path = join(root, MANIFEST);
  const manifest = await readFile(path, "utf8");
  const pinned = (
    JSON.parse(manifest) as {
      dependencies?: Record<string, string>;
    }
  ).dependencies?.[REMOTION];

  if (pinned === undefined) {
    throw new Error(
      `${path} declares no ${REMOTION} version to pin the template's fonts to`
    );
  }

  await writeFile(path, withDependencies(manifest, spec.dependencies(pinned)));
}

// A folder that is free, or the same name with a counter after it — the link
// can be opened twice and the second project must not land in the first one's
// tree, where the copy would skip every file and keep the first one's props.
export async function mintFolder(
  parent: string,
  name: string
): Promise<string> {
  await mkdir(parent, { recursive: true });
  return await claimFrom(parent, name, 1);
}

async function claimFrom(
  parent: string,
  name: string,
  attempt: number
): Promise<string> {
  if (attempt > SUFFIX_LIMIT) {
    throw new Error(`no free folder for ${name} under ${parent}`);
  }

  const path = join(parent, attempt === 1 ? name : `${name} ${attempt}`);
  return (await claim(path))
    ? path
    : await claimFrom(parent, name, attempt + 1);
}

async function claim(path: string): Promise<boolean> {
  try {
    await mkdir(path);
    return true;
  } catch (cause) {
    if ((cause as { code?: string }).code === "EEXIST") {
      return false;
    }
    throw cause;
  }
}
