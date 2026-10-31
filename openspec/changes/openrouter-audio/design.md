## Decisions

Use a separate OpenRouter provider so credentials and billing remain unambiguous. Verify keys through the read-only `/key` endpoint. Use `/audio/speech` for Eleven v4 and Seed Audio. Use streamed `/chat/completions` audio for Lyria 3 Pro.

Keep generation inside the existing prepare, approve, commit, and recover lifecycle. The core selects models and retains provider metadata in each operation. Preserve legacy operations whose optional provider metadata is absent. Do not automatically retry paid calls or echo provider error bodies.

Validate speech scripts, voice names, Seed prompt limits, response sizes, stream completion, and MP3 frames. OpenRouter selects MP3 bitrate. Music and sound-effect duration and instrumental preferences are prompt directions, disclosed before approval.

## Validation

Mock HTTP tests cover authorization, routing, payloads, stream errors, and audio validation. Contract and library tests cover narration, provenance, recovery, and video reuse. The packaged macOS app was installed and checked for OpenRouter discovery and its key entry form. Live generation with a funded account remains unverified.
