"use client";

import { SelectControl } from "dialkit";
import { useMemo } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAssetSearch } from "@/hooks/use-asset-search";
import type { ShaderInsertion } from "@/hooks/use-shader-insertion";
import type { Asset } from "@/shared/library";
import { SHADER_DESCRIPTORS } from "@/shared/shaders";
import { AssetGrid } from "./asset-grid";
import { AssetSearchField, NothingFound } from "./assets-pane";
import { PaneScreen } from "./pane-screen";

export function ShadersPane({
  assets,
  error,
  isLoading,
  onRetry,
  insertion,
}: {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  insertion: ShaderInsertion;
}) {
  const shaders = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.category === "Shaders" &&
          SHADER_DESCRIPTORS.some(
            (descriptor) => asset.slug === `remocn/${descriptor.slug}`
          )
      ),
    [assets]
  );
  const search = useAssetSearch(shaders);
  const showPreparation = Boolean(
    insertion.preparing ||
      insertion.canPrepare ||
      insertion.preparationError ||
      insertion.preparation?.phase === "failed"
  );
  return (
    <PaneScreen
      pinned={
        <div className="grid gap-3 pb-3">
          <AssetSearchField
            onChange={search.onQueryChange}
            value={search.query}
          />
          {showPreparation ? (
            <PreparationStatus insertion={insertion} />
          ) : (
            <TargetStatus insertion={insertion} />
          )}
          {insertion.recovery ? (
            <div className="grid gap-2 px-1 text-xs">
              <p role="status">
                {insertion.recovery.error ?? "Checking the previous insertion…"}
              </p>
              {insertion.recovery.error ? (
                <Button onClick={insertion.retry} size="xs" variant="outline">
                  Retry status check
                </Button>
              ) : null}
            </div>
          ) : null}
          <InsertionStatus insertion={insertion} />
        </div>
      }
    >
      {error ? (
        <div className="grid gap-2 px-1 text-xs">
          <p role="alert">{error}</p>
          <Button onClick={onRetry} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="px-1 text-muted-foreground text-xs" role="status">
          Loading shaders…
        </p>
      ) : null}
      {error || isLoading ? null : (
        <fieldset
          aria-label="Add a shader"
          className="min-w-0 border-0 p-0 disabled:opacity-60"
          disabled={insertion.unavailable !== null}
        >
          {search.found.length ? (
            <AssetGrid assets={search.found} onPick={insertion.onPick} />
          ) : (
            <NothingFound query={search.query} />
          )}
        </fieldset>
      )}
    </PaneScreen>
  );
}

function TargetStatus({ insertion }: { insertion: ShaderInsertion }) {
  const { eligible, target, unavailable } = insertion;
  const reason =
    unavailable ??
    (!target && eligible.length === 0
      ? "Select a video and scene to add a shader."
      : null);
  return (
    <>
      {eligible.length > 1 ? (
        <SelectControl
          label="Add to scene"
          onChange={insertion.selectTarget}
          options={eligible.map((item) => ({
            label: item.label,
            value: item.slotId,
          }))}
          value={target?.slotId ?? ""}
        />
      ) : null}
      {eligible.length <= 1 && target ? (
        <p className="px-1 text-muted-foreground text-xs">
          Add to {target.label}
        </p>
      ) : null}
      {reason ? (
        <p className="px-1 text-muted-foreground text-xs">{reason}</p>
      ) : null}
    </>
  );
}

function InsertionStatus({ insertion }: { insertion: ShaderInsertion }) {
  const { state } = insertion;
  return state ? (
    <div aria-live="polite" className="grid gap-2 px-1 text-xs">
      <p role={state.error ? "alert" : "status"}>
        {state.error ??
          (state.phase === "complete"
            ? "Shader added. Edit its colors and pattern in Inspect."
            : (state.progress?.message ?? "Waiting for the shader preview…"))}
      </p>
      <div className="flex flex-wrap gap-2">
        {state.phase === "preparing" ? (
          <Button onClick={insertion.cancel} size="xs" variant="outline">
            Cancel
          </Button>
        ) : null}
        {state.phase === "failed" ? (
          <Button onClick={insertion.retry} size="xs" variant="outline">
            {state.result ? "Retry preview" : "Retry insertion"}
          </Button>
        ) : null}
        {state.result ? (
          <Button onClick={insertion.undo} size="xs" variant="ghost">
            Undo insertion
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;
}

const PREPARATION_LABELS = {
  activating: "Connecting shaders…",
  failed: "Preparing video…",
  preparing: "Preparing video…",
  ready: "Preparing video…",
  validating: "Checking video…",
};

function PreparationStatus({ insertion }: { insertion: ShaderInsertion }) {
  if (insertion.preparing) {
    const label =
      PREPARATION_LABELS[insertion.preparation?.phase ?? "preparing"];
    return (
      <div
        className="grid min-h-12 content-center gap-1 px-1 text-xs"
        role="status"
      >
        <div className="flex items-center gap-2 font-medium">
          <Spinner
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground motion-reduce:animate-none"
          />
          <span>{label}</span>
        </div>
        <p className="pl-5.5 text-muted-foreground leading-relaxed">
          Follow progress in the chat.
        </p>
      </div>
    );
  }
  const error =
    insertion.preparationError ??
    (insertion.preparation?.phase === "failed"
      ? insertion.preparation.message
      : null);
  if (!(insertion.canPrepare || error)) {
    return null;
  }
  return (
    <div className="grid min-w-0 gap-2 px-1 text-xs">
      <div className="grid gap-1">
        <p className="font-medium" role={error ? "alert" : undefined}>
          {error ? "Couldn’t prepare video" : "Enable shaders for this video"}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {error
            ? "Check the details and try again."
            : "Your agent will prepare the scenes."}
        </p>
      </div>
      {error ? (
        <details className="group min-w-0">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
            Error details
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 group-open:rotate-180"
            />
          </summary>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words pb-2 text-muted-foreground leading-relaxed">
            {error}
          </p>
        </details>
      ) : null}
      {insertion.canPrepare ? (
        <Button
          className="min-h-10"
          disabled={insertion.preparationDisabled}
          onClick={insertion.prepareVideo}
          size="sm"
          variant="outline"
        >
          {error ? "Retry preparation" : "Prepare video"}
        </Button>
      ) : null}
      {insertion.canPrepare && insertion.preparationDisabled ? (
        <p className="text-muted-foreground leading-relaxed">
          Finish the current edit to prepare this video.
        </p>
      ) : null}
    </div>
  );
}
