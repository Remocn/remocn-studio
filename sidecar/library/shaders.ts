import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Data, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { BUNDLED_PREFIX } from "@/shared/library";
import { SHADER_DESCRIPTORS, ShaderDescriptor } from "@/shared/shaders";
import { contained, hashBytes } from "../projects/config";
import { bundledPlan, listBundled } from "./bundled";

export class ShaderError extends Data.TaggedError("ShaderError")<{
  message: string;
}> {}

export const shaderIO = <A>(work: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => new ShaderError({ message: errorMessage(cause) }),
    try: work,
  });
export const shaderFailure = (message: string) =>
  Effect.fail(new ShaderError({ message }));

const decodeDescriptor = Schema.decodeUnknownEffect(ShaderDescriptor);
export const SHADER_RESOURCE_ROOT = "src/lib/studio-shaders-v1";

export interface ShaderResource {
  readonly content: string;
  readonly hash: string;
  readonly path: string;
}
export interface ShaderResourcePlan {
  readonly descriptor: ShaderDescriptor;
  readonly files: readonly ShaderResource[];
  readonly packages: readonly string[];
}

export const shaderDescriptor = Effect.fn("shaderDescriptor")(function* (
  slug: string
) {
  const descriptor = SHADER_DESCRIPTORS.find((item) => item.slug === slug);
  if (!descriptor) {
    return yield* shaderFailure("This shader has no supported Studio adapter.");
  }
  return yield* decodeDescriptor(descriptor, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ShaderError({
          message: `Invalid shader descriptor: ${cause.message}`,
        })
    )
  );
});

export const listShaders = Effect.fn("listShaders")(function* () {
  const assets = yield* listBundled().pipe(
    Effect.mapError((cause) => new ShaderError({ message: cause.message }))
  );
  return yield* Effect.forEach(SHADER_DESCRIPTORS, (descriptor) =>
    Effect.gen(function* () {
      const checked = yield* shaderDescriptor(descriptor.slug);
      const asset = assets.find(
        (item) =>
          item.slug === `${BUNDLED_PREFIX}${checked.slug}` &&
          item.category === "Shaders"
      );
      if (!asset) {
        return yield* shaderFailure(
          `The bundled files for ${checked.title} are missing. Repair the Studio installation.`
        );
      }
      return { asset, descriptor: checked };
    })
  );
});

function resource(path: string, content: string): ShaderResource {
  return { content, hash: hashBytes(content), path };
}

export const shaderResourcePlan = Effect.fn("shaderResourcePlan")(function* (
  slug: string
) {
  const descriptor = yield* shaderDescriptor(slug);
  const template = process.env[TEMPLATE_DIR_ENV];
  if (!template) {
    return yield* shaderFailure(
      "Studio's shader runtime resources are unavailable."
    );
  }
  const upstream = yield* bundledPlan(slug).pipe(
    Effect.mapError((cause) => new ShaderError({ message: cause.message }))
  );
  if (!upstream) {
    return yield* shaderFailure(
      `The bundled implementation for ${descriptor.title} is missing.`
    );
  }
  const names = [
    "src/lib/studio-objects-v7/index.tsx",
    "src/lib/studio-objects-v7/shaders.tsx",
    "src/lib/studio-objects-v7/between.ts",
    "src/lib/studio-objects-v7/README.md",
    `${SHADER_RESOURCE_ROOT}/paper.tsx`,
    `${SHADER_RESOURCE_ROOT}/${descriptor.slug.replace("shader-", "")}.tsx`,
    `${SHADER_RESOURCE_ROOT}/README.md`,
  ];
  if (descriptor.slug !== "shader-mesh-gradient") {
    names.push(
      `${SHADER_RESOURCE_ROOT}/parameters.ts`,
      `${SHADER_RESOURCE_ROOT}/catalog-v1.md`
    );
    if (descriptor.adapter === "paper") {
      names.push(`${SHADER_RESOURCE_ROOT}/paper-adapter.tsx`);
    } else if (descriptor.slug === "shader-light-tunnel") {
      names.push(`${SHADER_RESOURCE_ROOT}/tunnel-renderer.ts`);
    } else {
      names.push(
        `${SHADER_RESOURCE_ROOT}/custom-adapter.tsx`,
        `${SHADER_RESOURCE_ROOT}/${descriptor.slug.replace("shader-", "")}-fragment.ts`
      );
    }
  }
  const runtime = yield* Effect.forEach(names, (path) =>
    shaderIO(async () =>
      resource(path, await readFile(await contained(template, path), "utf8"))
    )
  );
  const source = yield* Effect.forEach(upstream.files, (file) =>
    shaderIO(async () =>
      resource(
        `${SHADER_RESOURCE_ROOT}/upstream/${basename(file.target)}`,
        await readFile(file.from, "utf8")
      )
    )
  );
  const files = [
    ...runtime,
    ...source,
    resource(
      `${SHADER_RESOURCE_ROOT}/descriptors/${descriptor.slug}.json`,
      `${JSON.stringify(descriptor, null, 2)}\n`
    ),
  ];
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    return yield* shaderFailure(
      "The shader resource plan contains conflicting file paths."
    );
  }
  return {
    descriptor,
    files,
    packages: ["@paper-design/shaders", "@paper-design/shaders-react"],
  } satisfies ShaderResourcePlan;
});

export const checkShaderResources = Effect.fn("checkShaderResources")(
  function* (root: string, plan: ShaderResourcePlan) {
    return yield* Effect.forEach(plan.files, (file) =>
      shaderIO(async () => {
        const target = await contained(root, file.path);
        const content = await readFile(target, "utf8").catch(
          (cause: NodeJS.ErrnoException) => {
            if (cause.code === "ENOENT") {
              return null;
            }
            throw cause;
          }
        );
        if (
          content !== null &&
          hashBytes(content) !== file.hash &&
          !matchesDescriptor(file.path, content, plan.descriptor)
        ) {
          throw new ShaderError({
            message: `${file.path} has been edited. Studio cannot replace an authored shader resource.`,
          });
        }
        // The journal pins the bytes we accepted, including template JSON formatting.
        return {
          ...resource(file.path, content ?? file.content),
          reused: content !== null,
        };
      })
    );
  }
);

function matchesDescriptor(
  path: string,
  content: string,
  descriptor: ShaderDescriptor
) {
  if (path !== `${SHADER_RESOURCE_ROOT}/descriptors/${descriptor.slug}.json`) {
    return false;
  }
  try {
    return isDeepStrictEqual(JSON.parse(content), descriptor);
  } catch {
    return false;
  }
}
