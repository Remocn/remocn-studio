import type { PlaybackRate } from "./playback-rate";

export type TuningValue =
  | boolean
  | number
  | string
  | null
  | readonly (boolean | number | string | null)[];

export type StatusKind = "computed" | "keyframed" | "static";

export interface VideoConfigValues {
  readonly durationInFrames: number;
  readonly fps: number;
  readonly height: number;
  readonly width: number;
}

/** Remotion's own subscription key, carried whole between the two ends. */
export interface TuningNodePath {
  readonly absolutePath: string;
  readonly effectKeys: readonly (readonly string[])[];
  readonly nodePath: readonly (number | string)[];
  readonly sequenceKeys: readonly string[];
  readonly videoConfigValues: VideoConfigValues | null;
}

export interface TuningStatus {
  readonly kind: StatusKind;
  readonly status: unknown;
}

export interface TargetStatuses {
  readonly nodePath: TuningNodePath | null;
  readonly props: Readonly<Record<string, TuningStatus>>;
  readonly targetId: string;
}

export type StudioValue =
  | boolean
  | number
  | string
  | readonly [number, number, number, number];

export interface PreviewRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface PreviewWindow {
  readonly from: number;
  readonly until: number;
}

export type InspectStatus = "armed" | "disarmed" | "no-canvas";
export type SnapshotStatus = "armed" | "disarmed" | "no-canvas";
export type PreviewPick =
  | "asked"
  | "first"
  | "folder"
  | "main"
  | "missing"
  | "none";

export interface PreviewScene {
  readonly duration: number;
  readonly from: number;
  readonly id: string;
  readonly name: string;
}

export interface ElementScene {
  readonly durationInFrames: number;
  readonly frame: number;
  readonly from: number;
  readonly name: string;
}

export interface TuningChange {
  readonly from: TuningValue;
  readonly owner?: {
    readonly component: string;
    readonly file: string | null;
    readonly line: number | null;
    readonly name: string | null;
  };
  readonly path: string;
  readonly sampled?: boolean;
  readonly to: TuningValue;
}

export interface SelectedElement {
  readonly column: number | null;
  readonly component: string | null;
  readonly composition: string;
  readonly file: string | null;
  readonly fps: number;
  readonly frame: number;
  readonly html: string;
  readonly line: number | null;
  readonly scene: ElementScene | null;
  readonly stack: readonly string[];
  readonly tuningChanges?: readonly TuningChange[];
  readonly written?: boolean;
}

export type TuningFieldType =
  | "array"
  | "asset"
  | "boolean"
  | "color"
  | "enum"
  | "font-family"
  | "number"
  | "rotation-css"
  | "rotation-degrees"
  | "scale"
  | "text-content"
  | "transform-origin"
  | "translate"
  | "uv-coordinate";

export interface TuningField {
  readonly arrayItemType: TuningFieldType | null;
  readonly description: string | null;
  readonly group: string;
  readonly label: string;
  readonly max: number | null;
  readonly maxLength: number | null;
  readonly min: number | null;
  readonly minLength: number | null;
  readonly newItemDefault: TuningValue | null;
  readonly options: readonly string[];
  readonly path: string;
  readonly readOnly?: boolean;
  readonly step: number | null;
  readonly targetId: string;
  readonly type: TuningFieldType;
  readonly value: TuningValue;
}

export interface TuningWhere {
  readonly column: number | null;
  readonly file: string;
  readonly line: number | null;
}

export interface TuningTarget {
  readonly componentName: string;
  readonly fields: readonly TuningField[];
  readonly identity: string | null;
  readonly instanceId: string;
  readonly instances: number;
  readonly keys: readonly string[];
  readonly name: string | null;
  readonly ordinal: number;
  readonly origin: TuningWhere | null;
  readonly schema?: unknown;
  readonly targetId: string;
  readonly where: TuningWhere | null;
}

export interface PreviewMetadata {
  readonly durationInFrames: number;
  readonly fps: number;
  readonly height: number;
  readonly width: number;
}

export interface GeometryNumbers {
  readonly height: number;
  readonly rotation: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export type PreviewCommand =
  | {
      readonly enabled: boolean;
      readonly fields: readonly {
        readonly id: string;
        readonly max: number | null;
        readonly min: number | null;
        readonly value: number;
      }[];
      readonly generation: string;
      readonly objectId: string | null;
      readonly type: "studio.geometry.config";
      readonly video: string;
    }
  | {
      readonly error: string | null;
      readonly requestId: string;
      readonly type: "studio.geometry.result";
    }
  | {
      readonly generation: string;
      readonly objectId: string;
      readonly type: "studio.batch";
      readonly values: Readonly<Record<string, StudioValue>>;
    }
  | {
      readonly candidate: number;
      readonly label: string;
      readonly requestId: string;
      readonly type: "studio.text.open";
      readonly value: string;
    }
  | {
      readonly error: string | null;
      readonly requestId: string;
      readonly type: "studio.text.close";
    }
  | { readonly type: "inspect.clear" }
  | { readonly type: "transport.request" }
  | { readonly type: "transport.toggle" }
  | { readonly direction: -1 | 1; readonly type: "transport.step" }
  | {
      readonly muted: boolean;
      readonly type: "transport.audio";
      readonly volume: number;
    }
  | { readonly rate: PlaybackRate; readonly type: "transport.rate" }
  | { readonly type: "studio.request" }
  | {
      readonly field: string;
      readonly generation: string;
      readonly objectId: string;
      readonly type: "studio.draft";
      readonly value: StudioValue;
    }
  | {
      readonly generation: string;
      readonly objectId: string | null;
      readonly type: "studio.highlight";
      readonly video: string;
    }
  | { readonly objectId: string | null; readonly type: "studio.hover" }
  | {
      readonly selectors: readonly string[];
      readonly token: string;
      readonly type: "studio.hide";
    }
  | { readonly token: string; readonly type: "studio.unhide" }
  | { readonly armed: boolean; readonly type: "inspect" }
  | { readonly armed: boolean; readonly type: "snapshot" }
  | { readonly frame: number; readonly type: "seek" }
  | {
      readonly from: number;
      readonly type: "replay";
      readonly until: number;
    }
  | { readonly type: "pause" }
  | {
      readonly targets: readonly TargetStatuses[];
      readonly type: "tuning.statuses";
    }
  | {
      readonly open: boolean;
      readonly targetId: string | null;
      readonly type: "highlight";
    }
  | {
      readonly path: string;
      readonly requestId: string;
      readonly targetId: string;
      readonly type: "tune.set";
      readonly value: TuningValue;
    }
  | {
      readonly paths: readonly string[];
      readonly requestId: string;
      readonly targetId: string;
      readonly type: "tune.reset";
    };

export type PreviewMessage =
  | { readonly type: "studio.geometry.request" }
  | {
      readonly binding: {
        readonly height: string;
        readonly rotation: string | null;
        readonly width: string;
        readonly x: string;
        readonly y: string;
      };
      readonly generation: string;
      readonly objectId: string;
      readonly requestId: string;
      readonly type: "studio.geometry.begin";
      readonly values: GeometryNumbers;
      readonly video: string;
    }
  | {
      readonly requestId: string;
      readonly type: "studio.geometry.commit";
      readonly values: GeometryNumbers;
    }
  | { readonly requestId: string; readonly type: "studio.geometry.cancel" }
  | {
      readonly candidates: readonly {
        readonly field: string | null;
        readonly text: string;
      }[];
      readonly generation: string;
      readonly objectId: string;
      readonly requestId: string;
      readonly type: "studio.text.request";
      readonly video: string;
    }
  | {
      readonly requestId: string;
      readonly type: "studio.text.commit";
      readonly value: string;
    }
  | { readonly requestId: string; readonly type: "studio.text.cancel" }
  | { readonly type: "inspect.ready" }
  | { readonly type: "inspect.clear" }
  | {
      readonly generation: string;
      readonly lastOperationId: string | null;
      readonly type: "studio.ready";
      readonly video: string;
    }
  | {
      readonly generation: string;
      readonly objectId: string;
      readonly type: "studio.select";
      readonly video: string;
    }
  | { readonly ids: readonly string[]; readonly type: "studio.present" }
  | {
      readonly compositionId: string | null;
      readonly compositions: readonly string[];
      readonly metadata: PreviewMetadata | null;
      readonly reason: PreviewPick;
      readonly total: number;
      readonly trouble: string | null;
      readonly type: "composition";
      readonly unmeasured: boolean;
    }
  | {
      readonly assetBase: string | null;
      readonly assets: readonly string[];
      readonly element: SelectedElement;
      readonly fonts: readonly string[];
      readonly rect: PreviewRect;
      readonly repeat: boolean;
      readonly text: string | null;
      readonly tuning: readonly TuningTarget[];
      readonly type: "selection";
      readonly video: VideoConfigValues | null;
      readonly window: PreviewWindow | null;
    }
  | {
      readonly frame: number;
      readonly playing: boolean;
      readonly type: "playhead";
    }
  | {
      readonly buffering: boolean;
      readonly compositionId: string;
      readonly error: string | null;
      readonly muted: boolean;
      readonly type: "transport.state";
      readonly volume: number;
    }
  | {
      readonly compositionId: string;
      readonly scenes: readonly PreviewScene[];
      readonly type: "scenes";
    }
  | {
      readonly paused: boolean;
      readonly status: InspectStatus;
      readonly type: "inspect";
    }
  | {
      readonly paused: boolean;
      readonly status: SnapshotStatus;
      readonly type: "snapshot";
    }
  | {
      readonly composition: string;
      readonly frame: number;
      readonly rect: PreviewRect | null;
      readonly type: "capture";
    }
  | { readonly type: "rebuilt" }
  | {
      readonly error: string | null;
      readonly ok: boolean;
      readonly requestId: string;
      readonly type: "tune.result";
    }
  | { readonly type: "canvas.menu" };

export type EntrySignal =
  | { readonly type: "native.painted" }
  | { readonly message: string; readonly type: "native.error" };

export type CommandType = PreviewCommand["type"];
export type CommandOf<T extends CommandType> = Extract<
  PreviewCommand,
  { type: T }
>;
export type MessageType = PreviewMessage["type"];
export type MessageOf<T extends MessageType> = Extract<
  PreviewMessage,
  { type: T }
>;

export type Consumer =
  | "geometry"
  | "inline-text"
  | "managed"
  | "player"
  | "rate"
  | "transport";

type Interrupts = "geometry" | "inline-text";

export interface CommandConsumers {
  highlight: "player";
  inspect: "player";
  "inspect.clear": "player";
  pause: "player";
  replay: "player" | Interrupts;
  seek: "player" | Interrupts;
  snapshot: "player";
  "studio.batch": "managed";
  "studio.draft": "managed";
  "studio.geometry.config": "geometry";
  "studio.geometry.result": "geometry";
  "studio.hide": "player";
  "studio.highlight": "player";
  "studio.hover": "player";
  "studio.request": "managed";
  "studio.text.close": "inline-text";
  "studio.text.open": "inline-text";
  "studio.unhide": "player";
  "transport.audio": "transport";
  "transport.rate": "rate";
  "transport.request": "transport";
  "transport.step": "transport" | Interrupts;
  "transport.toggle": "transport" | Interrupts;
  "tune.reset": "player";
  "tune.set": "player";
  "tuning.statuses": "player";
}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type EveryCommandRouted = Assert<
  Same<keyof CommandConsumers, CommandType>
>;

export type CommandsOf<C extends Consumer> = {
  [K in CommandType]: C extends CommandConsumers[K] ? K : never;
}[CommandType];

export type Routes<C extends Consumer> = {
  readonly [K in CommandsOf<C>]: (command: CommandOf<K>) => void;
};
