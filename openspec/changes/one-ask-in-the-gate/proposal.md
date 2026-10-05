## Why

Answers Linear REM-629. The permission ask — look up a remembered approval,
raise the card, wait for the answer, apply what the answer carries — is written
twice, once for Claude Code (`sidecar/claude/guard.ts`, `decide`) and once for
Copilot and Grok (`sidecar/acp/permission.ts`, `answerPermission`), and the
paid-sound flow (`sidecar/integrations/sounds.ts`) calls `gate.wait` a third way.
The copies have drifted, and two of the drifts are defects a person can hit:

1. **A symlink leads out of the folder without a card on Copilot and Grok.** The
   protocol bridge checks "inside the folder" with its own `inside()` —
   `resolve` plus `startsWith`, no `realpath` — while Claude Code goes through
   `escapee` in `sidecar/contained.ts`, which follows links. A link inside the
   project that points outside it passes as "inside" and the file tool runs
   unasked, against the #223 invariant.
2. **The mode chosen on a plan card is lost on Copilot and Grok.** Only the Claude
   guard applies `answer.mode`; the protocol options carry no way to apply it, the
   protocol turn never binds the mode switch, and a protocol request to leave plan
   mode (`switch_mode`) is shown as a generic "Approve this tool call?" card that
   offers no mode at all.

## What Changes

- One ask, owned by the gate: given a verdict, the gate consults remembered
  approvals, raises the card, waits (ten minutes, then deny), applies an approved
  mode to the chat, and answers Allow or Deny. Adapters only produce the verdict
  and translate the answer into their runtime's reply. Paid sounds go through the
  same ask, still raised together so they share one card.
- Copilot and Grok resolve every location the way Claude Code does — symlinks and
  `..` followed, a file not yet created resolved through its nearest existing
  ancestor — so a link leading out raises a card naming the resolved destination.
- A protocol request to switch out of plan mode is a plan card, like Claude's.
  Approving into a mode switches the running Copilot/Grok turn into it, stores it
  as the chat's mode and re-streams the chat, so the next turn starts in it too.
- The protocol turn keeps track of the mode the agent reports it is in, so the next
  turn's mode switch is not skipped on a stale record.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/permissions`: protocol providers resolve locations through symlinks like
  every other path; a protocol request to leave plan mode is a plan card whose
  approved mode reaches the running turn and the chat.

## Impact

- Shared contract: none. Asks are the same `permission` events, answers the same
  `agent.permission` request. No protocol bump, no migration, no settings key.
- Sidecar: `sidecar/agent/gate.ts` gains the one ask and a per-turn binding;
  `sidecar/claude/guard.ts`, `sidecar/acp/permission.ts`,
  `sidecar/integrations/sounds.ts` and `sidecar/acp/turn.ts` call it;
  `sidecar/agent/adapter.ts` (`TurnServices`) and `sidecar/handlers.ts` change
  shape to pass it. The verdict type and `signatureOf` move out of `sidecar/claude/`
  into `sidecar/agent/`, so the protocol bridge no longer imports from Claude's
  folder.
- Rust core: none. Webview: none — the plan card already renders a `plan` reason.

## Non-goals

- Codex. It raises no cards; its sandbox is the gate, and that stays.
- Reading the shipped skills bundle without a card on Copilot and Grok. Claude
  Code's read-only exception for the bundle is not extended here; protocol
  providers keep asking for it as they do today.
- Following a mode the agent switches into on its own, without a card, into the
  chat's stored mode. Only a mode the person chose on a card is stored.
- Changing the card's wording or the ten-minute deadline.
