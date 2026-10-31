## Why

Studio's audio integration requires a direct ElevenLabs key and has no narration tool. People with OpenRouter credits need to generate audio through that connection.

## What changes

Add OpenRouter to Integrations, add Eleven v4 narration, and route existing sound-effect and music requests to Seed Audio and Lyria 3 when an OpenRouter connection is selected. Keep keys in Rust and the keychain. Reuse paid approval, durable operations, library imports, and video attachment.

## Capabilities

- New: `integrations/openrouter-audio`.
- Modified: audio source metadata and narration requests in the shared protocol, incremented to 41 in Rust and TypeScript.

## Impact

Rust adds OpenRouter HTTP handling and base64 stream decoding. The sidecar gains a narration tool and provider-aware provenance. The UI identifies the actual audio provider. Existing ElevenLabs connections and assets remain valid.
