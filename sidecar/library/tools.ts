import { isAbsolute, resolve } from "node:path";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { errorMessage } from "@/lib/error-message";
import {
  ASSET_TYPES,
  type Asset,
  type AssetDraft,
  type AssetType,
  assetTypeFor,
} from "@/shared/library";

export const LIBRARY_SERVER = "remocn-library";

export const LIBRARY_TOOL_PREFIX = `mcp__${LIBRARY_SERVER}__`;

export interface LibraryControls {
  readonly cwd: string;
  readonly list: () => Promise<readonly Asset[]>;
  readonly save: (draft: AssetDraft) => Promise<Asset>;
}

export function libraryServer(controls: LibraryControls) {
  return createSdkMcpServer({
    name: LIBRARY_SERVER,
    tools: [
      tool(
        "list_assets",
        "List everything in the studio's asset library: images, videos, audio and finished Remotion components the person saved from earlier videos. Call it when they ask what is in the library, or ask you to reuse something without saying which reference it is.",
        {},
        () =>
          answer(async () => {
            const assets = await controls.list();

            if (assets.length === 0) {
              return "The library is empty.";
            }

            return assets.map(inventory).join("\n\n");
          })
      ),
      tool(
        "save_asset",
        "Save something from this project into the studio's asset library so it can be reused in other videos. You decide the boundaries: gather every file the thing needs — the component and whatever it imports that is not a package — and give it a name and a one-line description the person would recognise. Call it when they ask to save a scene, an animation or a piece of media to the library.",
        {
          dependencies: z
            .array(z.string())
            .optional()
            .describe(
              "npm packages the files import, beyond react and remotion — e.g. @remotion/shapes, three."
            ),
          description: z
            .string()
            .optional()
            .describe("One line saying what this is, in the person's words."),
          files: z
            .array(z.string())
            .min(1)
            .describe(
              "Every file the asset needs, as paths inside this project. Relative paths resolve against the project folder."
            ),
          name: z.string().min(1).describe("A short human name for the asset."),
          type: z
            .enum(ASSET_TYPES as unknown as [AssetType])
            .optional()
            .describe("Left out, it is worked out from the file extensions."),
        },
        (args) =>
          answer(async () => {
            const files = args.files.map((file) =>
              isAbsolute(file) ? file : resolve(controls.cwd, file)
            );

            const saved = await controls.save({
              dependencies: args.dependencies ?? [],
              description: args.description ?? "",
              duration: null,
              files,
              name: args.name,
              preview: null,
              type: args.type ?? assetTypeFor(files),
            });

            return `Saved ${saved.name} to the library as ${saved.slug} (${saved.type}), holding ${saved.files.length} file${saved.files.length === 1 ? "" : "s"}. It is now available in every project.`;
          })
      ),
    ],
  });
}

function inventory(asset: Asset): string {
  const lines = [`${asset.name} — ${asset.type}`];

  if (asset.description.length > 0) {
    lines.push(asset.description);
  }

  lines.push(`files: ${asset.files.join(", ")}`);

  if (asset.dependencies.length > 0) {
    lines.push(`needs: ${asset.dependencies.join(", ")}`);
  }

  return lines.join("\n");
}

async function answer(run: () => Promise<string>) {
  try {
    return { content: [{ text: await run(), type: "text" as const }] };
  } catch (cause) {
    return {
      content: [{ text: errorMessage(cause), type: "text" as const }],
      isError: true,
    };
  }
}
