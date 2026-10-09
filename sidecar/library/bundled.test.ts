import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Effect, Schema } from "effect";
import { CAPTION_NAMES } from "@/scripts/remocn-sources";
import { REMOCN_DIR_ENV } from "@/shared/ipc";
import { Asset, PromptAsset, promptAssetOf } from "@/shared/library";
import { bundledPlan, listBundled } from "./bundled";

const old = process.env[REMOCN_DIR_ENV];
beforeEach(() => {
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
});
afterEach(() => {
  if (old === undefined) {
    delete process.env[REMOCN_DIR_ENV];
  } else {
    process.env[REMOCN_DIR_ENV] = old;
  }
});
describe("bundled captions", () => {
  it("lists 31 ordinary component assets, without the timing helper or motion roles", async () => {
    const assets = (await Effect.runPromise(listBundled())).filter(
      (asset) => asset.category === "Captions"
    );
    expect(
      assets.map((asset) => asset.slug.slice("remocn/".length)).sort()
    ).toEqual([...CAPTION_NAMES]);
    for (const asset of assets) {
      expect(asset.role).toBeNull();
      expect(asset.type).toBe("component");
      expect(Schema.decodeUnknownSync(Asset)(asset)).toEqual(asset);
      expect(
        Schema.decodeUnknownSync(PromptAsset)(promptAssetOf(asset))
      ).toEqual(promptAssetOf(asset));
      expect(asset.preview).not.toBeNull();
      expect(asset.clip).not.toBeNull();
      expect(statSync(asset.preview ?? "").size).toBeGreaterThan(100);
      expect(statSync(asset.clip ?? "").size).toBeGreaterThan(100);
    }
  });
  it("places the real registry closure, including the caption package and no fixtures", async () => {
    const plans = await Promise.all(
      CAPTION_NAMES.map((name) => Effect.runPromise(bundledPlan(name)))
    );
    for (const [index, name] of CAPTION_NAMES.entries()) {
      const plan = plans[index];
      expect(plan?.captionStyle).toBe(name);
      expect(plan?.dependencies).toContain("@remotion/captions");
      expect(
        plan?.files.some(
          (file) => file.target === "src/lib/remocn/caption-core.ts"
        )
      ).toBe(true);
      expect(plan?.files.some((file) => file.target.includes("fixture"))).toBe(
        false
      );
      for (const file of plan?.files ?? []) {
        expect(readFileSync(file.from, "utf8").length).toBeGreaterThan(0);
      }
    }
  });
});
