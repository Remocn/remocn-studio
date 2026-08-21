import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { StockProgress, StockQuery } from "@/shared/ipc";
import type { Asset, StockItem, StockPage } from "@/shared/library";

export function searchStock(
  query: StockQuery
): Effect.Effect<StockPage, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.stockSearch",
      params: query,
    });
  });
}

export function saveStock(
  item: StockItem,
  onProgress: (progress: StockProgress) => void
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.stockSave",
      onStream: onProgress,
      params: item,
    });
  });
}

export const stockStatus: Effect.Effect<boolean, SidecarError> = Effect.gen(
  function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.stockStatus",
      params: null,
    });

    return answer.configured;
  }
);

export function setStockKey(
  key: string | null
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.stockKey",
      params: { key },
    });

    return answer.configured;
  });
}
