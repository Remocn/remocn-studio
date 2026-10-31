# OpenRouter audio

In Settings > Integrations, add OpenRouter and paste an OpenRouter API key. The studio verifies it with `GET https://openrouter.ai/api/v1/key` and stores it in the system keychain. Keys stay out of agent requests and project files.

Enable the providers you intend to use in your OpenRouter account and accept any required provider terms. In particular, Seed must be accepted for sound effects. Key verification alone does not establish access to every model provider.

Ask the studio's agent to use your OpenRouter connection:

- "Generate narration with Eleven v4 saying: Welcome to our demo."
- "Generate that narration with Eleven v4 and the sarah voice."
- "Generate a sound effect of rain on a tin roof using OpenRouter."
- "Generate instrumental piano music using OpenRouter."

The existing approval card appears before each paid request. Completed audio is saved in the library. Use the result card to attach it to a video. Failed or interrupted requests are never automatically retried.

## Models and endpoints

Verified against OpenRouter's catalog and documentation on October 31, 2026.

| Task | Model | Endpoint |
| --- | --- | --- |
| Narration | `elevenlabs/eleven-v4` | `/api/v1/audio/speech` |
| Sound effects | `bytedance-seed/seed-audio-1-0` | `/api/v1/audio/speech` |
| Music | `google/lyria-3-pro-preview` | `/api/v1/chat/completions` |

New narration always uses full Eleven v4. Turbo and older models are rejected before dispatch. Existing Turbo assets remain readable, and regenerating them uses Eleven v4 with the same voice.

Narration supports the 21 built-in ElevenLabs voices listed in the model catalog, defaults to `george`, and accepts up to 10,000 Unicode characters. Sound-effect prompts, including the duration direction, are limited to 3,000 characters. Seed Audio infers the sound from the prompt; it does not read the description aloud as a script.

For OpenRouter music and sound effects, duration is a prompt request rather than an exact output-length control. The instrumental preference is also a prompt direction. OpenRouter chooses the MP3 bitrate; the existing default format is accepted, but explicit 192 kbps requests are rejected before generation. Music is read from streamed audio chunks and validated before saving. Provider availability, output format acceptance, and generation quality still require testing with a funded key.

Direct ElevenLabs connections and their existing assets remain supported. No ElevenLabs key is sent to OpenRouter, and no OpenRouter key is sent to ElevenLabs.

## Audio direction

Before generation, the agent reads the video scenes and script, chooses emotion and pacing per scene, and uses concise inline delivery tags such as `[curious]` or `[calm, reassuring voice]`. These guide performance rather than guarantee it. Neutral delivery remains appropriate when the brief calls for it. Eleven v4 uses audio tags and punctuation rather than SSML break tags.

Sound effects get a cue list tied to visible events, with timing, duration, texture, and level relative to narration. Precisely timed effects stay separate from the voiceover. The agent measures generated durations and must distinguish visual inspection from listening to the audio.

## Troubleshooting provider access

If Seed refuses an otherwise valid request, check OpenRouter's provider settings and accept Seed's terms before changing the prompt. Failures include the requested model and HTTP status. The studio never switches the provider or repeats a paid request automatically.

ElevenLabs' dedicated SFX v3 is a separate, limited-access model from Eleven v4 narration. It is present in the official ElevenLabs SDK and direct API, but was absent from OpenRouter's speech catalog when checked on October 31, 2026. OpenRouter sound effects therefore continue to use Seed Audio.

## Sources

- [OpenRouter ElevenLabs announcement](https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/)
- [Speech API and Seed Audio prompts](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [Streaming audio responses](https://openrouter.ai/docs/guides/overview/multimodal/audio)
- [Lyria 3 Pro](https://openrouter.ai/google/lyria-3-pro-preview)
- [Live speech model catalog](https://openrouter.ai/api/v1/models?output_modalities=speech)
- [ElevenLabs vocal direction](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- [ElevenLabs sound-effects models](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- [Official ElevenLabs SDK sound-effects model IDs](https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/types/sfx_model_id.py)
