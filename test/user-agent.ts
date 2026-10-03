// happy-dom registers a Linux user agent (test/register-dom.ts); a test of
// macOS behaviour switches to MAC and puts LINUX back afterwards.
export const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";
export const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

export function withAgent(agent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: agent,
  });
}
