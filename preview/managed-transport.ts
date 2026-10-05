import { post, route } from "./bridge";
import type { PreviewCommand, PreviewMessage } from "./protocol";

const subscriptions = new Map<(event: MessageEvent) => void, () => void>();
export const managedTransport = {
  addEventListener(_type: "message", receive: (event: MessageEvent) => void) {
    subscriptions.get(receive)?.();
    const deliver = (command: PreviewCommand) =>
      receive(
        new MessageEvent("message", {
          data: { ...command, source: "remocn-studio" },
          source: window.parent,
        })
      );
    subscriptions.set(
      receive,
      route("managed", {
        "studio.batch": deliver,
        "studio.draft": deliver,
        "studio.request": deliver,
      })
    );
  },
  postMessage(message: PreviewMessage, _origin: string) {
    post(message);
  },
  removeEventListener(
    _type: "message",
    receive: (event: MessageEvent) => void
  ) {
    subscriptions.get(receive)?.();
    subscriptions.delete(receive);
  },
};
