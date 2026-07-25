import type { ContextUsage } from "@/shared/ipc";

export interface ContextReading {
  percent: number;
  remaining: string;
  used: string;
}

export function contextReading(usage: ContextUsage): ContextReading {
  const max = Math.max(usage.maxTokens, 0);
  const used = Math.min(Math.max(usage.totalTokens, 0), max);

  return {
    percent: max === 0 ? 0 : Math.round((used / max) * 100),
    remaining: compactTokens(max - used),
    used: compactTokens(used),
  };
}

export function compactTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${trim(tokens / 1_000_000)}M`;
  }
  if (tokens >= 1000) {
    return `${trim(tokens / 1000)}k`;
  }
  return String(Math.round(tokens));
}

function trim(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}
