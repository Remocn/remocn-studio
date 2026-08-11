const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function frameTime(frame: number, fps: number): string {
  if (!(Number.isFinite(fps) && fps > 0)) {
    return `frame ${frame}`;
  }

  const total = Math.max(0, frame) / fps;
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  const tenths = Math.floor((total * 10) % 10);

  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

// The badge on a clip's thumbnail: mm:ss, and h:mm:ss once it earns an hour.
export function clipTime(seconds: number): string | null {
  if (!(Number.isFinite(seconds) && seconds >= 0)) {
    return null;
  }

  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60) % 60;
  const rest = String(whole % 60).padStart(2, "0");
  const hours = Math.floor(whole / 3600);

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
}

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
