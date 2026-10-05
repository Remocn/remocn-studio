import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Internals } from "remotion";
import { anchorContainer, anchorOf, resolveAnchor } from "./anchor";
import { assetValue } from "./assets";
import type { TargetStatuses, TuningNodePath, TuningValue } from "./protocol";
import { originOf } from "./stack";
import { surface } from "./surface";
import { type TimeWindow, windowOf } from "./timing";
import {
  controlsChain,
  type DraftValue,
  describeTuning,
  emptyPlan,
  fieldAt,
  type InteractivitySchema,
  isFieldValue,
  isPlumbing,
  nameIn,
  nearestInteractive,
  plainName,
  publishPlan,
  type Rebound,
  rebind,
  sameMappings,
  type TuningTarget,
} from "./tuning";
import {
  activate,
  type TuningReply,
  type TuningRuntime,
} from "./tuning-runtime";

interface SequenceControls {
  readonly componentIdentity?: string | null;
  readonly componentName: string;
  readonly currentRuntimeValueDotNotation: Readonly<Record<string, unknown>>;
  readonly overrideId: string;
  readonly schema: InteractivitySchema;
}

interface InteractiveSequence {
  readonly controls: SequenceControls | null;
  readonly refForOutline: { current: Element | null } | null;
}

type NodePath = TuningNodePath;

interface TargetEntry {
  anchor: string;
  componentName: string;
  key: string;
  label: string;
  live: readonly string[];
  node: Element | null;
  nodePath: NodePath;
  // What the codemod read out of the file for this element, once the app has
  // asked for it. `null` until then, and for ever on a project whose Remotion
  // is too old to answer — which is the one state that costs writing and
  // nothing else.
  statuses: TargetStatuses | null;
  window: TimeWindow | null;
}

function countedIn(
  sequences: readonly InteractiveSequence[],
  overrideId: string,
  node: Element | null
): { instances: number; ordinal: number } {
  const same = sequences.filter(
    (sequence) => sequence.controls?.overrideId === overrideId
  );

  if (same.length < 2) {
    return { instances: Math.max(1, same.length), ordinal: 1 };
  }

  const order = [...(anchorContainer()?.querySelectorAll("*") ?? [])];
  const ordered = same
    .map((sequence, registered) => {
      const outline = sequence.refForOutline?.current ?? null;
      const seen = outline === null ? -1 : order.indexOf(outline);

      return {
        node: outline,
        rank: seen === -1 ? order.length + registered : seen,
      };
    })
    .toSorted((first, second) => first.rank - second.rank);

  const at =
    node === null
      ? -1
      : ordered.findIndex(
          (entry) =>
            entry.node !== null &&
            (entry.node === node || entry.node.contains(node))
        );

  return { instances: same.length, ordinal: at === -1 ? 1 : at + 1 };
}

function resolverFor(
  entries: readonly TargetEntry[],
  container: Element | null
): (anchor: string) => Element | null {
  const cache = new Map<string, Element | null>();

  for (const entry of entries) {
    if (entry.node?.isConnected) {
      cache.set(entry.anchor, entry.node);
    }
  }

  return (anchor) => {
    const hit = cache.get(anchor);

    if (hit !== undefined) {
      return hit;
    }

    const found = container === null ? null : resolveAnchor(anchor, container);

    cache.set(anchor, found);
    return found;
  };
}

function applyRebound(
  registry: Map<string, TargetEntry>,
  results: readonly Rebound[],
  edited: (key: string) => boolean
): TargetEntry[] {
  const gained: TargetEntry[] = [];

  for (const result of results) {
    const entry = registry.get(result.key);

    if (entry === undefined) {
      continue;
    }

    const before = new Set(entry.live);
    const was = entry.live;

    entry.live = result.live;
    entry.node = result.node;

    if (debugging() && !sameIds(was, result.live)) {
      console.log("remocn:rebind", entry.key, { now: result.live, was });
    }

    if (edited(result.key) && result.live.some((id) => !before.has(id))) {
      gained.push(entry);
    }
  }

  return gained;
}

function offscreen(entry: TargetEntry | undefined, at: number): string {
  const head = `This element is not on screen at frame ${at}.`;

  if (entry === undefined || entry.window === null) {
    return head;
  }

  return `${head} ${entry.label} runs from frame ${entry.window.from} to ${entry.window.until}.`;
}

function mountedControls(entry: TargetEntry): SequenceControls | null {
  const { node } = entry;

  if (node === null || !node.isConnected) {
    return null;
  }

  const links = controlsChain(node) as readonly {
    controls: SequenceControls;
  }[];

  return (
    links.find((link) => link.controls.componentName === entry.componentName)
      ?.controls ?? null
  );
}

// Remotion records the JSX call site against the controls object itself, in
// `development`, off `jsxDEV`'s source argument. It is the only coordinate that
// names the element whose props are about to be rewritten — the component stack
// names the component that rendered it, which is a different file.
function stackOf(controls: SequenceControls): string | null {
  const read = (
    Internals as unknown as {
      getStackForControls?: (value: unknown) => string | null;
    }
  ).getStackForControls;

  return typeof read === "function" ? read(controls) : null;
}

function rootPath(): string {
  return surface().project;
}

function debugging(): boolean {
  return (
    (globalThis as unknown as { remocn_debug?: boolean }).remocn_debug === true
  );
}

function sameIds(was: readonly string[], now: readonly string[]): boolean {
  return was.length === now.length && was.every((id, at) => id === now[at]);
}

function reportPick(
  key: string,
  controls: SequenceControls,
  sequences: readonly InteractiveSequence[]
): void {
  if (!debugging()) {
    return;
  }

  console.log("remocn:pick", key, {
    picked: controls.overrideId,
    registered: sequences.flatMap((sequence) =>
      sequence.controls?.componentName === controls.componentName
        ? [sequence.controls.overrideId]
        : []
    ),
  });
}

export function InteractivityRuntime({
  children,
  frame,
}: {
  readonly children: React.ReactNode;
  readonly frame: () => number;
}) {
  const { sequences } = useContext(Internals.SequenceManager);
  const setters = useContext(Internals.VisualModeSettersContext);
  const [mappings, setMappings] = useState<Record<string, NodePath>>({});
  const mappingsRef = useRef<Record<string, NodePath>>({});
  const drafts = useRef(new Map<string, Record<string, DraftValue>>());
  const targets = useRef(new Map<string, TargetEntry>());
  const minted = useRef(0);

  const interactive = sequences as unknown as readonly InteractiveSequence[];

  const syncMappings = useCallback(() => {
    const next: Record<string, NodePath> = {};

    for (const entry of targets.current.values()) {
      for (const id of entry.live) {
        next[id] = entry.nodePath;
      }
    }

    if (sameMappings(mappingsRef.current, next)) {
      return;
    }

    mappingsRef.current = next;
    setMappings(next);
  }, []);

  const entryFor = useCallback(
    (key: string, anchor: string, componentName: string): TargetEntry => {
      const found = targets.current.get(key);

      if (found !== undefined) {
        return found;
      }

      minted.current += 1;
      const id = String(minted.current);
      const created: TargetEntry = {
        anchor,
        componentName,
        key,
        label: componentName,
        live: [],
        node: null,
        // A key of our own until the codemod answers with Remotion's. It is
        // never a real address, so nothing can be written through it — it only
        // has to be unique, so two elements' drafts cannot collide.
        nodePath: {
          absolutePath: `remocn.${id}`,
          effectKeys: [],
          nodePath: ["remocn", id],
          sequenceKeys: [],
          videoConfigValues: null,
        },
        statuses: null,
        window: null,
      };

      targets.current.set(key, created);
      return created;
    },
    []
  );

  const controlsFor = useCallback(
    (key: string): SequenceControls | null => {
      const entry = targets.current.get(key);

      if (entry === undefined) {
        return null;
      }

      for (const id of entry.live) {
        const found =
          interactive.find((sequence) => sequence.controls?.overrideId === id)
            ?.controls ?? null;

        if (found !== null) {
          return found;
        }
      }

      return mountedControls(entry);
    },
    [interactive]
  );

  const valuesFor = useCallback(
    (
      key: string,
      controls: SequenceControls | null
    ): Record<string, unknown> => {
      if (controls === null) {
        return {};
      }

      const values: Record<string, unknown> = {
        ...controls.currentRuntimeValueDotNotation,
      };

      for (const [path, held] of Object.entries(
        drafts.current.get(key) ?? {}
      )) {
        values[path] = held.value;
      }

      return values;
    },
    []
  );

  const tunable = typeof setters.setPropStatuses === "function";

  const replay = useCallback(
    (entry: TargetEntry) => {
      const plan = publishPlan(
        drafts.current.get(entry.key) ?? {},
        entry.statuses
      );

      setters.clearDragOverrides(entry.nodePath as never);

      for (const step of plan.overrides) {
        setters.setDragOverrides(
          entry.nodePath as never,
          step.path,
          step.keyframed === null
            ? Internals.makeStaticDragOverride(step.value)
            : (Internals.makeKeyframedDragOverride({
                frame: step.frame,
                status: step.keyframed as never,
                value: step.value,
              }) as never)
        );
      }

      setters.setPropStatuses(
        entry.nodePath as never,
        () => plan.statuses as never
      );
    },
    [setters]
  );

  useEffect(() => {
    if (targets.current.size === 0) {
      return;
    }

    const entries = [...targets.current.values()];
    const gained = applyRebound(
      targets.current,
      rebind(entries, interactive, resolverFor(entries, anchorContainer())),
      (key) => drafts.current.has(key)
    );

    syncMappings();

    for (const entry of gained) {
      replay(entry);
    }
  }, [interactive, replay, syncMappings]);

  const set = useCallback(
    (targetId: string, path: string, value: TuningValue): TuningReply => {
      const entry = targets.current.get(targetId);
      const controls = controlsFor(targetId);

      if (entry === undefined || controls === null) {
        return { error: offscreen(entry, frame()), ok: false };
      }

      if (!tunable) {
        return {
          error:
            "This project's Remotion cannot apply live parameter changes in the preview.",
          ok: false,
        };
      }

      const field = fieldAt(
        controls.schema,
        valuesFor(targetId, controls),
        path
      );

      if (field === null || !isFieldValue(field, value)) {
        return {
          error: "That value is not valid for this control.",
          ok: false,
        };
      }

      drafts.current.set(targetId, {
        ...drafts.current.get(targetId),
        // The frame rides with the value because a keyframed key is edited at
        // one: the override adds or moves the keyframe there, and a replay has
        // to rebuild it at the same frame rather than at whatever is on screen.
        [path]: {
          frame: frame(),
          // The pane holds an asset as the name of a file in `public/`; the
          // runtime wants its URL under the surface's asset base.
          value:
            field.type === "asset" && typeof value === "string"
              ? assetValue(value)
              : value,
        },
      });

      if (!entry.live.includes(controls.overrideId)) {
        entry.live = [controls.overrideId, ...entry.live];
        syncMappings();
      }

      replay(entry);

      return { error: null, ok: true };
    },
    [controlsFor, frame, replay, syncMappings, tunable, valuesFor]
  );

  const reset = useCallback(
    (targetId: string, paths: readonly string[]): TuningReply => {
      const entry = targets.current.get(targetId);

      if (entry === undefined) {
        return { error: null, ok: true };
      }

      if (paths.length === 0) {
        drafts.current.delete(targetId);
      } else {
        const next = { ...drafts.current.get(targetId) };

        for (const path of paths) {
          delete next[path];
        }

        if (Object.keys(next).length === 0) {
          drafts.current.delete(targetId);
        } else {
          drafts.current.set(targetId, next);
        }
      }

      replay(entry);
      return { error: null, ok: true };
    },
    [replay]
  );

  const clear = useCallback(() => {
    const empty = emptyPlan().statuses;

    for (const entry of targets.current.values()) {
      setters.clearDragOverrides(entry.nodePath as never);
      setters.setPropStatuses(entry.nodePath as never, () => empty as never);
    }

    drafts.current.clear();
    targets.current.clear();
    mappingsRef.current = {};
    setMappings({});
  }, [setters]);

  const selectedTargets = useCallback(
    (element: Element): TuningTarget[] => {
      // The chain, innermost first — and it stays a chain rather than being
      // folded into one list. Merging it was wrong: pointing at a word then
      // showed the parameters of every component above it, up to the camera
      // that frames the whole scene. What you clicked is what the pane opens
      // on; the ancestors are offered, not imposed.
      const chain = controlsChain(element) as readonly {
        controls: SequenceControls;
        node: Element | null;
      }[];
      const nearest = nearestInteractive(interactive, element);
      const fallback = nearest?.controls ?? null;
      const spare =
        fallback === null
          ? []
          : [
              {
                controls: fallback as SequenceControls,
                node: nearest?.refForOutline?.current ?? null,
              },
            ];
      const found = chain.length > 0 ? chain : spare;
      const container = anchorContainer();
      const used = new Set<string>();
      const kept = new Set<string>();

      const picked = found.flatMap(({ controls, node }, index) => {
        const host = node ?? element;
        const anchor = container === null ? "" : anchorOf(host, container);
        const base =
          anchor.length > 0
            ? `${anchor}::${controls.componentName}`
            : controls.overrideId;
        const key = used.has(base) ? `${base}::${index}` : base;

        used.add(key);

        const values = valuesFor(key, controls);
        const part = describeTuning({
          componentName: controls.componentName,
          identity: controls.componentIdentity ?? null,
          instanceId: anchor,
          origin: originOf(rootPath(), stackOf(controls)),
          schema: controls.schema,
          targetId: key,
          values,
          ...countedIn(interactive, controls.overrideId, node),
        });

        if (part === null || (index > 0 && isPlumbing(part))) {
          return [];
        }

        const entry = entryFor(key, anchor, controls.componentName);

        entry.componentName = controls.componentName;
        entry.label = nameIn(values) ?? plainName(controls.componentName);
        entry.live = [controls.overrideId];
        entry.node = host;
        entry.window = windowOf(host);
        kept.add(key);
        reportPick(key, controls, interactive);

        return [part];
      });

      for (const key of [...targets.current.keys()]) {
        if (!(kept.has(key) || drafts.current.has(key))) {
          targets.current.delete(key);
        }
      }

      syncMappings();

      return picked;
    },
    [entryFor, interactive, syncMappings, valuesFor]
  );

  // The codemod's answer lands after the pick, so a target may swap its
  // address here: the overrides published under the placeholder are taken down
  // first, or they would be left addressed to a key nothing reads.
  const applyStatuses = useCallback(
    (answered: readonly TargetStatuses[]) => {
      let moved = false;

      for (const answer of answered) {
        const entry = targets.current.get(answer.targetId);

        if (entry === undefined) {
          continue;
        }

        if (answer.nodePath !== null && entry.nodePath !== answer.nodePath) {
          setters.clearDragOverrides(entry.nodePath as never);
          setters.setPropStatuses(
            entry.nodePath as never,
            () => emptyPlan().statuses as never
          );
          entry.nodePath = answer.nodePath;
          moved = true;
        }

        entry.statuses = answer;
      }

      if (moved) {
        syncMappings();
      }

      for (const answer of answered) {
        const entry = targets.current.get(answer.targetId);
        if (entry !== undefined) {
          replay(entry);
        }
      }
    },
    [replay, setters, syncMappings]
  );

  const runtime = useMemo<TuningRuntime>(
    () => ({
      clear,
      reset,
      set,
      statuses: applyStatuses,
      targetsOf: selectedTargets,
    }),
    [applyStatuses, clear, reset, selectedTargets, set]
  );

  useEffect(() => activate(runtime), [runtime]);

  const environment = useMemo(
    () => ({
      isClientSideRendering: false,
      isPlayer: true,
      isReadOnlyStudio: false,
      isRendering: false,
      isStudio: true,
    }),
    []
  );

  const mapping = useMemo(
    () => ({ overrideIdToNodePathMappings: mappings as never }),
    [mappings]
  );

  return (
    <Internals.OverrideIdsToNodePathsGettersContext.Provider value={mapping}>
      <Internals.RemotionEnvironmentContext.Provider value={environment}>
        {children}
      </Internals.RemotionEnvironmentContext.Provider>
    </Internals.OverrideIdsToNodePathsGettersContext.Provider>
  );
}
