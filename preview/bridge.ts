export const MESSAGE_SOURCE = "remocn-preview";
export const COMMAND_SOURCE = "remocn-studio";

export type PreviewCommand =
  | { armed: boolean; type: "inspect" }
  | { frame: number; type: "seek" }
  | { frozen: boolean; type: "freeze" };

export function post(message: Record<string, unknown>): void {
  window.parent.postMessage({ ...message, source: MESSAGE_SOURCE }, "*");
}

export function onCommand(
  handle: (command: PreviewCommand) => void
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || typeof event.data !== "object") {
      return;
    }

    const frame = event.data as { source?: unknown; type?: unknown };

    if (frame.source !== COMMAND_SOURCE || typeof frame.type !== "string") {
      return;
    }

    handle(event.data as PreviewCommand);
  };

  window.addEventListener("message", listener);

  return () => {
    window.removeEventListener("message", listener);
  };
}
