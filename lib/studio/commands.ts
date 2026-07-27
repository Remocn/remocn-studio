const WORD = String.raw`"[^"]*"|'[^']*'|\S+`;

const LEAD = new RegExp(
  String.raw`^(?:cd\s+(?:${WORD})\s*&&\s*|[A-Za-z_]\w*=(?:${WORD})\s+)+`
);

export function commandLead(command: string): string {
  const body = command.replace(LEAD, "");
  return command.slice(0, command.length - body.length);
}
