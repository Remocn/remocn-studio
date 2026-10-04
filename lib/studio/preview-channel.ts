import { Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import type * as Protocol from "@/preview/protocol";
import {
  decodePreviewMessage,
  type PreviewCommand,
  type PreviewMessage,
  type PreviewMessageOf,
} from "./preview";

export type StampedMessage = Protocol.PreviewMessage & {
  readonly source: string;
};

export interface PreviewSurface {
  dispose: () => void;
  focus: () => void;
  send: (command: PreviewCommand) => void;
  subscribe: (receive: (message: StampedMessage) => void) => () => void;
}

export interface PreviewEpoch {
  readonly build: number;
  readonly url: string | null;
  readonly video: string | null;
}

export interface PreviewChannel {
  attach: (surface: PreviewSurface) => () => void;
  disconnect: () => void;
  epoch: () => PreviewEpoch;
  focus: () => void;
  on: <T extends Protocol.MessageType>(
    type: T,
    handle: (message: PreviewMessageOf<T>) => void
  ) => () => void;
  onEpoch: (listen: () => void) => () => void;
  send: (command: PreviewCommand) => void;
  serve: (url: string | null) => void;
}

export const EMPTY_COMPOSITIONS_SETTLE_MS = 250;

const FIRST: PreviewEpoch = { build: 0, url: null, video: null };

type Handler = (message: PreviewMessage) => void;

export function createPreviewChannel(): PreviewChannel {
  const handlers = new Map<Protocol.MessageType, Set<Handler>>();
  const watchers = new Set<() => void>();
  let epoch = FIRST;
  let current: { surface: PreviewSurface; disconnect: () => void } | null =
    null;
  let pendingEmpty: ReturnType<typeof setTimeout> | null = null;

  const cancelPendingEmpty = () => {
    if (pendingEmpty !== null) {
      clearTimeout(pendingEmpty);
      pendingEmpty = null;
    }
  };

  const advance = (next: PreviewEpoch) => {
    if (
      next.build === epoch.build &&
      next.url === epoch.url &&
      next.video === epoch.video
    ) {
      return;
    }
    epoch = next;
    for (const watch of [...watchers]) {
      watch();
    }
  };

  const dispatch = (message: PreviewMessage) => {
    if (message.type === "composition") {
      advance({ ...epoch, video: message.compositionId });
    } else if (message.type === "rebuilt") {
      advance({ ...epoch, build: epoch.build + 1 });
    } else if (
      (message.type === "transport.state" || message.type === "scenes") &&
      message.compositionId !== epoch.video
    ) {
      return;
    }
    for (const handle of [...(handlers.get(message.type) ?? [])]) {
      handle(message);
    }
  };

  const receive = (data: unknown) => {
    if (epoch.url === null) {
      return;
    }
    const decoded = decodePreviewMessage(data);
    if (Exit.isFailure(decoded)) {
      warnUndecodable(data, causeMessage(decoded.cause));
      return;
    }
    const message = decoded.value;
    if (message.type === "composition") {
      cancelPendingEmpty();
      if (message.compositions.length === 0) {
        pendingEmpty = setTimeout(() => {
          pendingEmpty = null;
          dispatch(message);
        }, EMPTY_COMPOSITIONS_SETTLE_MS);
        return;
      }
    }
    dispatch(message);
  };

  const attach = (surface: PreviewSurface) => {
    current?.disconnect();
    let unsubscribe: () => void = () => undefined;
    let connected = true;
    const connection = {
      disconnect: () => {
        if (!connected) {
          return;
        }
        connected = false;
        if (current === connection) {
          current = null;
        }
        try {
          unsubscribe();
        } finally {
          surface.dispose();
        }
      },
      surface,
    };
    current = connection;
    try {
      unsubscribe = surface.subscribe((message) => {
        if (connected && current === connection) {
          receive(message);
        }
      });
      if (!connected) {
        unsubscribe();
      }
    } catch (error) {
      connection.disconnect();
      throw error;
    }
    return connection.disconnect;
  };

  return {
    attach,
    disconnect: () => {
      cancelPendingEmpty();
      current?.disconnect();
    },
    epoch: () => epoch,
    focus: () => current?.surface.focus(),
    on: (type, handle) => {
      const listeners = handlers.get(type) ?? new Set<Handler>();
      handlers.set(type, listeners);
      const listener = handle as Handler;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onEpoch: (listen) => {
      watchers.add(listen);
      return () => {
        watchers.delete(listen);
      };
    },
    send: (command) => current?.surface.send(command),
    serve: (url) => {
      if (url === epoch.url) {
        return;
      }
      cancelPendingEmpty();
      advance({ ...epoch, url });
    },
  };
}

function warnUndecodable(data: unknown, issue: string | null): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const type =
    typeof data === "object" && data !== null && "type" in data
      ? String(data.type)
      : "unknown";
  console.warn(
    `The preview sent a "${type}" message the studio could not read: ${issue ?? "no detail"}`
  );
}
