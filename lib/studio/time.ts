const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);

  if (elapsed < MINUTE) {
    return "just now";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}h ago`;
  }
  if (elapsed < WEEK) {
    return `${Math.floor(elapsed / DAY)}d ago`;
  }

  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function elapsedTime(since: number, now: number): string {
  const elapsed = Math.max(0, now - since);

  if (elapsed < MINUTE) {
    return "<1m";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    const minutes = Math.floor((elapsed % HOUR) / MINUTE);
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  return `${Math.floor(elapsed / DAY)}d`;
}

export function runningTime(since: number, now: number): string {
  const elapsed = Math.max(0, now - since);

  if (elapsed < MINUTE) {
    return `${Math.floor(elapsed / SECOND)}s`;
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    const seconds = Math.floor((elapsed % MINUTE) / SECOND);
    return `${minutes}m ${seconds}s`;
  }

  return elapsedTime(since, now);
}
