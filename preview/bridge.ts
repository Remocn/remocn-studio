import type {
  CommandType,
  Consumer,
  EntrySignal,
  PreviewCommand,
  PreviewMessage,
  Routes,
} from "./protocol";

interface LocalBridge {
  emit: (message: PreviewMessage | EntrySignal) => void;
  subscribe: (receive: (command: PreviewCommand) => void) => () => void;
}
let local: LocalBridge | null = null;

export function configureBridge(bridge: LocalBridge): () => void {
  local = bridge;
  return () => {
    if (local === bridge) {
      local = null;
    }
  };
}

export function post(message: PreviewMessage | EntrySignal): void {
  const bridge = local;
  if (!bridge) {
    return;
  }
  queueMicrotask(() => {
    if (local === bridge) {
      bridge.emit(message);
    }
  });
}

export function route<C extends Consumer>(
  _consumer: C,
  handlers: Routes<C>
): () => void {
  if (!local) {
    throw new Error("The preview bridge is not configured.");
  }
  const table: Partial<Record<CommandType, (command: PreviewCommand) => void>> =
    handlers;
  return local.subscribe((command) => {
    table[command.type]?.(command);
  });
}
