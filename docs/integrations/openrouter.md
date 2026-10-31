# OpenRouter audio

In Settings > Integrations, add OpenRouter and paste an OpenRouter API key. The studio verifies it with `GET https://openrouter.ai/api/v1/key` and stores it in the system keychain. Keys stay out of agent requests and project files.

Ask the studio's agent to use your OpenRouter connection:

- "Generate narration with Eleven v4 saying: Welcome to our demo."
- "Generate that narration with Eleven v4 Turbo and the sarah voice."
- "Generate a sound effect of rain on a tin roof using OpenRouter."
- "Generate instrumental piano music using OpenRouter."

The existing approval card appears before each paid request. Completed audio is saved in the library. Use the result card to attach it to a video. Failed or interrupted requests are never automatically retried.

## Models and endpoints

Verified against OpenRouter's catalog and documentation on October 31, 2026.

| Task | Model | Endpoint |
| --- | --- | --- |
| Narration, default | `elevenlabs/eleven-v4` | `/api/v1/audio/speech` |
| Faster narration | `elevenlabs/eleven-v4-turbo` | `/api/v1/audio/speech` |
| Sound effects | `bytedance-seed/seed-audio-1-0` | `/api/v1/audio/speech` |
| Music | `google/lyria-3-pro-preview` | `/api/v1/chat/completions` |

Narration supports the 21 built-in ElevenLabs voices listed in the model catalog, defaults to `george`, and accepts up to 10,000 Unicode characters. Sound-effect prompts, including the duration direction, are limited to 3,000 characters. Seed Audio infers the sound from the prompt; it does not read the description aloud as a script.

For OpenRouter music and sound effects, duration is a prompt request rather than an exact output-length control. The instrumental preference is also a prompt direction. OpenRouter chooses the MP3 bitrate; the existing default format is accepted, but explicit 192 kbps requests are rejected before generation. Music is read from streamed audio chunks and validated before saving. Provider availability, output format acceptance, and generation quality still require testing with a funded key.

Direct ElevenLabs connections and their existing assets remain supported. No ElevenLabs key is sent to OpenRouter, and no OpenRouter key is sent to ElevenLabs.

## Sources

- [OpenRouter ElevenLabs announcement](https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/)
- [Speech API and Seed Audio prompts](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [Streaming audio responses](https://openrouter.ai/docs/guides/overview/multimodal/audio)
- [Lyria 3 Pro](https://openrouter.ai/google/lyria-3-pro-preview)
- [Live speech model catalog](https://openrouter.ai/api/v1/models?output_modalities=speech)
