import type { PreviewControl } from "@/hooks/use-preview";
import type { PreviewCommand } from "@/lib/studio/preview";
import {
  createPreviewChannel,
  type PreviewSurface,
  type StampedMessage,
} from "@/lib/studio/preview-channel";
import type { PreviewMessage } from "@/preview/protocol";

export const PREVIEW_URL = "http://127.0.0.1:51749/?composition=Main";

export interface MemorySurface extends PreviewSurface {
  readonly attached: () => boolean;
  readonly disposed: () => number;
  readonly emit: (message: PreviewMessage) => void;
  readonly focused: () => number;
  readonly post: (data: unknown) => void;
  readonly reveal: (messages: readonly PreviewMessage[]) => void;
  readonly sent: PreviewCommand[];
}

export function memorySurface(): MemorySurface {
  const listeners = new Set<(message: StampedMessage) => void>();
  const sent: PreviewCommand[] = [];
  let disposed = 0;
  let focused = 0;
  const deliver = (message: StampedMessage) => {
    for (const listen of [...listeners]) {
      listen(message);
    }
  };
  const stamp = (message: PreviewMessage): StampedMessage => ({
    ...message,
    source: "remocn-preview",
  });
  return {
    attached: () => listeners.size > 0,
    dispose: () => {
      disposed += 1;
    },
    disposed: () => disposed,
    emit: (message) => deliver(stamp(message)),
    focus: () => {
      focused += 1;
    },
    focused: () => focused,
    post: (data) => deliver(data as StampedMessage),
    reveal: (messages) => {
      for (const message of messages) {
        deliver(stamp(message));
      }
    },
    send: (command) => {
      sent.push(command);
    },
    sent,
    subscribe: (receive) => {
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    },
  };
}

export interface PreviewHarness {
  readonly preview: PreviewControl;
  readonly surface: MemorySurface;
}

export function previewControl(
  overrides: Partial<PreviewControl> = {}
): PreviewHarness {
  const surface = memorySurface();
  const channel = overrides.channel ?? createPreviewChannel();
  const preview: PreviewControl = {
    attachSurface: channel.attach,
    channel,
    composition: null,
    focus: channel.focus,
    frameOf: () => 0,
    hint: null,
    isServing: true,
    onFrame: () => () => undefined,
    pick: null,
    playing: false,
    preview: { phase: "ready", url: PREVIEW_URL },
    restart: () => undefined,
    ...overrides,
  };
  channel.serve(preview.preview.phase === "ready" ? preview.preview.url : null);
  channel.attach(surface);
  return { preview, surface };
}
