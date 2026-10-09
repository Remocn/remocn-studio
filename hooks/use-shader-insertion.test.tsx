import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import type { MouseEvent } from "react";
import { SidecarError } from "@/lib/studio/sidecar";
import type { PreviewMessage } from "@/preview/protocol";
import {
  MESH_GRADIENT,
  type ShaderInserted,
  type ShaderInsertionStatus,
  type ShaderInsertRequest,
  type ShaderTargets,
  shaderCreation,
} from "@/shared/shaders";
import {
  applyStudioOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { documentFixture } from "@/test/fixtures/studio-document";
import { previewControl } from "@/test/preview-channel";
import { useManagedObjects } from "./use-managed-objects";
import { useShaderInsertion } from "./use-shader-insertion";

beforeEach(() => localStorage.clear());
const pick = {
  currentTarget: { value: "remocn/shader-mesh-gradient" },
} as MouseEvent<HTMLButtonElement>;
function setup(
  options: {
    preparation?: ShaderTargets;
    prepare?: (revision: string) => boolean;
    overlap?: boolean;
    fail?: boolean;
    held?: Promise<void>;
    ready?: boolean;
    unsupported?: boolean;
  } = {}
) {
  const { preview, surface } = previewControl({
    composition: "intro",
    restart: mock(),
  });
  let saved: StudioSnapshot = {
    document: structuredClone(documentFixture),
    revision: "initial",
  };
  let receipt: ShaderInserted | null = null;
  const requests: ShaderInsertRequest[] = [];
  const targets = mock(() => {
    if (options.preparation) {
      return Effect.succeed(options.preparation);
    }
    return options.unsupported
      ? Effect.fail(
          new SidecarError({
            message:
              "This video needs shader slots in its scenes before adding shaders.",
          })
        )
      : Effect.succeed({
          adaptation: false,
          reason: null,
          targets: options.overlap
            ? [
                shaderTargetFixture,
                {
                  ...shaderTargetFixture,
                  label: "Second",
                  slotId: "scene-two",
                },
              ]
            : [shaderTargetFixture],
        });
  });
  const insert = mock((request: ShaderInsertRequest) =>
    Effect.tryPromise({
      catch: (cause) => new SidecarError({ message: String(cause) }),
      try: async () => {
        requests.push(request);
        await options.held;
        if (options.fail) {
          throw new Error("Preparation failed");
        }
        const operation = shaderCreation(
          MESH_GRADIENT,
          request.target,
          request.operationId,
          request.objectId,
          0
        );
        saved = {
          document: applyStudioOperation(
            saved.document,
            operation,
            request.target
          ),
          revision: request.operationId,
        };
        receipt = {
          receipt: {
            objectId: request.objectId,
            operationId: request.operationId,
            target: request.target,
          },
          snapshot: saved,
        };
        return receipt;
      },
    })
  );
  const status = mock(() =>
    Effect.succeed<ShaderInsertionStatus>(
      receipt ? { result: receipt, state: "saved" } : { state: "unknown" }
    )
  );
  const read = () => Effect.succeed(saved);
  const write = (params: {
    operation: Parameters<typeof applyStudioOperation>[1];
  }) =>
    Effect.sync(() => {
      saved = {
        document: applyStudioOperation(saved.document, params.operation),
        revision: params.operation.id,
      };
      return saved;
    });
  const hook = renderHook(
    ({ projectId }) => {
      const managed = useManagedObjects({
        armed: true,
        enabled: true,
        preview,
        projectId,
        read,
        write,
      });
      const insertion = useShaderInsertion({
        enabled: true,
        insert,
        managed,
        prepare: options.prepare,
        preview,
        projectId,
        status,
        targets,
      });
      return { insertion, managed };
    },
    { initialProps: { projectId: "project-1" } }
  );
  const emit = (message: PreviewMessage) => act(() => surface.emit(message));
  const ready = (
    generation = "build-1",
    lastOperationId: string | null = null
  ) =>
    emit({ generation, lastOperationId, type: "studio.ready", video: "intro" });
  if (options.ready !== false) {
    ready();
  }
  return {
    ...hook,
    emit,
    insert,
    options,
    preview,
    ready,
    requests,
    saved: () => saved,
    status,
    targets,
  };
}

describe("shader insertion coordination", () => {
  it("checks videos without a managed runtime instead of waiting forever for studio.ready", async () => {
    const test = setup({ ready: false, unsupported: true });
    await waitFor(
      () =>
        expect(test.result.current.insertion.unavailable).toBe(
          "This video needs shader slots in its scenes before adding shaders."
        ),
      { timeout: 300 }
    );
    expect(test.targets).toHaveBeenCalledWith({
      generation: null,
      projectId: "project-1",
      video: "intro",
    });
    act(() => test.result.current.insertion.onPick(pick));
    expect(test.insert).not.toHaveBeenCalled();
  });

  it("checks the newly opened project even when neither preview sends managed messages", async () => {
    const test = setup({ ready: false, unsupported: true });
    await waitFor(() => expect(test.targets).toHaveBeenCalledTimes(1));
    test.rerender({ projectId: "project-two" });
    await waitFor(() => expect(test.targets).toHaveBeenCalledTimes(2));
    expect(test.targets).toHaveBeenLastCalledWith({
      generation: null,
      projectId: "project-two",
      video: "intro",
    });
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBe(
        "This video needs shader slots in its scenes before adding shaders."
      )
    );
  });

  it("requires an explicit scene during an overlap and holds one identity on double click", async () => {
    const test = setup({ overlap: true });
    await waitFor(() =>
      expect(test.result.current.insertion.eligible).toHaveLength(2)
    );
    expect(test.result.current.insertion.unavailable).toBe(
      "Choose a scene for this shader."
    );
    act(() => test.result.current.insertion.onPick(pick));
    expect(test.insert).not.toHaveBeenCalled();
    act(() => test.result.current.insertion.selectTarget("scene-two"));
    act(() => {
      test.result.current.insertion.onPick(pick);
      test.result.current.insertion.onPick(pick);
    });
    await waitFor(() => expect(test.requests).toHaveLength(1));
    expect(test.requests[0].target.slotId).toBe("scene-two");
  });
  it("gates Export and opens Inspect only after matching generation, operation, object and slot", async () => {
    const test = setup();
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.result).not.toBeNull()
    );
    expect(test.result.current.insertion.blockExport).toBe(true);
    const [request] = test.requests;
    test.ready("build-2", request.operationId);
    const ack = {
      generation: "build-1",
      objectId: request.objectId,
      operationId: request.operationId,
      slotId: request.target.slotId,
      type: "shader.ready" as const,
      video: "intro",
    };
    test.emit(ack);
    expect(test.result.current.insertion.blockExport).toBe(true);
    test.emit({ ...ack, generation: "build-2", objectId: "different" });
    expect(test.result.current.insertion.blockExport).toBe(true);
    test.emit({ ...ack, generation: "build-2" });
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("complete")
    );
    expect(test.result.current.managed.selected?.id).toBe(request.objectId);
    expect(test.result.current.managed.isOpen).toBe(true);
    expect(test.result.current.insertion.blockExport).toBe(false);
  });
  it("waits for the refreshed scene before accepting another shader", async () => {
    const test = setup();
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("preview")
    );
    const [first] = test.requests;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = {
      ...shaderTargetFixture,
      generation: "build-2",
      sourceRevision: "source-2",
    };
    test.targets.mockImplementationOnce(() =>
      Effect.promise(async () => {
        await held;
        return { adaptation: false, reason: null, targets: [next] };
      })
    );
    try {
      test.ready("build-2", first.operationId);
      test.emit({
        generation: "build-2",
        objectId: first.objectId,
        operationId: first.operationId,
        slotId: first.target.slotId,
        type: "shader.ready",
        video: "intro",
      });
      await waitFor(() =>
        expect(test.result.current.insertion.state?.phase).toBe("complete")
      );
      act(() => test.result.current.insertion.onPick(pick));
      expect(test.requests).toHaveLength(1);
      release();
      await waitFor(() =>
        expect(test.result.current.insertion.unavailable).toBeNull()
      );
      act(() => test.result.current.insertion.onPick(pick));
      await waitFor(() => expect(test.requests).toHaveLength(2));
      expect(test.requests[1].target).toEqual(next);
      expect(test.requests[1].objectId).not.toBe(first.objectId);
    } finally {
      release();
    }
  });
  it("refreshes a rejected preflight on Retry without duplicating the operation", async () => {
    const test = setup({ fail: true });
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("failed")
    );
    const [first] = test.requests;
    const next = {
      ...shaderTargetFixture,
      generation: "build-2",
      sourceRevision: "source-2",
    };
    test.options.fail = false;
    test.options.preparation = {
      adaptation: false,
      reason: null,
      targets: [next],
    };
    test.ready("build-2");
    act(() => test.result.current.insertion.retry());
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("preview")
    );
    expect(test.requests[1]).toEqual({ ...first, target: next });
  });
  it("preserves a journaled request on Retry when the preview generation changes", async () => {
    const test = setup({ fail: true });
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    test.status.mockImplementation(() =>
      Effect.succeed<ShaderInsertionStatus>({
        message: "Preparation failed",
        request: test.requests[0],
        state: "failed",
      })
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("failed")
    );
    const [first] = test.requests;
    test.options.fail = false;
    test.options.preparation = {
      adaptation: false,
      reason: null,
      targets: [{ ...shaderTargetFixture, generation: "build-2" }],
    };
    test.ready("build-2");
    act(() => test.result.current.insertion.retry());
    await waitFor(() => expect(test.requests).toHaveLength(2));
    expect(test.requests[1]).toEqual(first);
  });
  it("retries preparation with the same operation and object IDs", async () => {
    const test = setup({ fail: true });
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("failed")
    );
    test.options.fail = false;
    act(() => test.result.current.insertion.retry());
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("preview")
    );
    expect(test.requests).toHaveLength(2);
    expect(test.requests[1]).toEqual(test.requests[0]);
  });
  it("does not select or gate the new project when the old request finishes", async () => {
    let finish: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const test = setup({ held });
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() => expect(test.requests).toHaveLength(1));
    test.rerender({ projectId: "project-two" });
    await act(async () => {
      finish();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(test.result.current.insertion.state).toBeNull();
    expect(test.result.current.insertion.blockExport).toBe(false);
    expect(test.result.current.managed.selected).toBeNull();
  });
  it("undoes a saved insertion without waiting for its render acknowledgement", async () => {
    const test = setup();
    await waitFor(() =>
      expect(test.result.current.insertion.unavailable).toBeNull()
    );
    act(() => test.result.current.insertion.onPick(pick));
    await waitFor(() =>
      expect(test.result.current.insertion.state?.phase).toBe("preview")
    );
    test.ready("build-2", test.requests[0].operationId);
    await waitFor(() =>
      expect(test.result.current.managed.objects).toHaveLength(4)
    );
    act(() => test.result.current.insertion.undo());
    await waitFor(() => expect(test.result.current.insertion.state).toBeNull());
    expect(
      test
        .saved()
        .document.objects.find(
          (object) => object.id === test.requests[0].objectId
        )?.removed
    ).toBe(true);
    expect(test.result.current.insertion.blockExport).toBe(false);
  });
});

it("recovers the saved insertion after reopening and keeps Export blocked when status lookup fails", async () => {
  const test = setup();
  await waitFor(() =>
    expect(test.result.current.insertion.unavailable).toBeNull()
  );
  act(() => test.result.current.insertion.onPick(pick));
  await waitFor(() =>
    expect(test.result.current.insertion.state?.phase).toBe("preview")
  );
  test.rerender({ projectId: "other" });
  test.status.mockImplementationOnce(() =>
    Effect.die(new Error("Sidecar disconnected"))
  );
  test.rerender({ projectId: "project-1" });
  await waitFor(() =>
    expect(test.result.current.insertion.recovery?.error).toBeTruthy()
  );
  expect(test.result.current.insertion.blockExport).toBe(true);
  act(() => test.result.current.insertion.retry());
  await waitFor(() =>
    expect(test.result.current.insertion.state?.phase).toBe("preview")
  );
  expect(test.insert).toHaveBeenCalledTimes(1);
  expect(test.result.current.insertion.state?.request).toEqual(
    test.requests[0]
  );
});

it("keeps saved but unacknowledged shaders recoverable after the preview timeout", async () => {
  const test = setup();
  await waitFor(() =>
    expect(test.result.current.insertion.unavailable).toBeNull()
  );
  act(() => test.result.current.insertion.onPick(pick));
  await waitFor(() =>
    expect(test.result.current.insertion.state?.phase).toBe("preview")
  );
  await waitFor(
    () => expect(test.result.current.insertion.state?.phase).toBe("failed"),
    { timeout: 16_000 }
  );
  expect(test.result.current.insertion.blockExport).toBe(true);
  act(() => test.result.current.insertion.onPick(pick));
  expect(test.insert).toHaveBeenCalledTimes(1);
  act(() => test.result.current.insertion.retry());
  expect(test.preview.restart).toHaveBeenCalledTimes(1);
  expect(test.result.current.insertion.state?.phase).toBe("preview");
}, 20_000);

it("offers explicit preparation without invoking the agent from a shader card", async () => {
  const prepare = mock(() => true);
  const capabilities: ShaderTargets = {
    adaptation: false,
    preparationRevision: "source-1",
    reason: "The scene timing needs preparation.",
    targets: [],
  };
  const test = setup({ preparation: capabilities, prepare });
  await waitFor(() =>
    expect(test.result.current.insertion.canPrepare).toBe(true)
  );
  expect(prepare).not.toHaveBeenCalled();
  act(() => test.result.current.insertion.onPick(pick));
  expect(test.insert).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
  act(() => test.result.current.insertion.prepareVideo());
  expect(prepare).toHaveBeenCalledWith("source-1");
  expect(test.result.current.insertion.blockExport).toBe(true);
  act(() => test.result.current.insertion.prepareVideo());
  expect(prepare).toHaveBeenCalledTimes(1);
  test.options.preparation = {
    ...capabilities,
    preparation: {
      historyId: "prepare-chat",
      message: "Waiting for preview",
      phase: "activating",
    },
  };
  test.ready();
  await waitFor(() =>
    expect(test.result.current.insertion.preparation?.phase).toBe("activating")
  );
  expect(test.result.current.insertion.unavailable).toBe("Waiting for preview");
  test.options.preparation = {
    adaptation: false,
    preparation: {
      historyId: "prepare-chat",
      message: "Ready",
      phase: "ready",
    },
    reason: null,
    targets: [shaderTargetFixture],
  };
  test.ready();
  await waitFor(() =>
    expect(test.result.current.insertion.preparing).toBe(false)
  );
  expect(test.result.current.insertion.unavailable).toBeNull();
  expect(test.requests).toHaveLength(0);
});
it("explains missing agent configuration and preserves retry after failed preparation", async () => {
  const capabilities: ShaderTargets = {
    adaptation: false,
    preparation: {
      historyId: "previous",
      message: "The agent could not run",
      phase: "failed",
    },
    preparationRevision: "source-1",
    reason: "Needs preparation",
    targets: [],
  };
  const test = setup({ preparation: capabilities });
  await waitFor(() =>
    expect(test.result.current.insertion.canPrepare).toBe(true)
  );
  act(() => test.result.current.insertion.prepareVideo());
  expect(test.result.current.insertion.preparationError).toContain(
    "configured agent"
  );
  expect(test.result.current.insertion.canPrepare).toBe(true);
  expect(test.requests).toHaveLength(0);
});
it("does not carry preparation state or export blocking into another video scope", async () => {
  const test = setup({
    preparation: {
      adaptation: false,
      preparationRevision: "source-1",
      reason: "Needs preparation",
      targets: [],
    },
    prepare: () => true,
  });
  await waitFor(() =>
    expect(test.result.current.insertion.canPrepare).toBe(true)
  );
  act(() => test.result.current.insertion.prepareVideo());
  expect(test.result.current.insertion.blockExport).toBe(true);
  test.options.preparation = { adaptation: false, reason: null, targets: [] };
  test.rerender({ projectId: "project-2" });
  await waitFor(() =>
    expect(test.result.current.insertion.preparing).toBe(false)
  );
  expect(test.result.current.insertion.blockExport).toBe(false);
});
