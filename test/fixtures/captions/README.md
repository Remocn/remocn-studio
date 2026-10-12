# Caption render fixture

`speech.wav` is whisper.cpp v1.5.5's `samples/jfk.wav`, the excerpt of John F.
Kennedy's inaugural address used by its recognition examples.
Source: https://github.com/ggml-org/whisper.cpp/blob/v1.5.5/samples/jfk.wav

`captions.json` is real recognition output from `@remotion/install-whisper-cpp`
4.0.534, whisper.cpp 1.5.5, `tiny.en`, language `en`, token-level timestamps,
`--no-gpu`, on macOS arm64. Saved on 2026-10-08. This fixture tests timing and
rendering, not transcription accuracy. Recognition took 607.3 ms, excluding
installation and model download. No recognition code runs during rendering.

Run `REMOCN_CAPTION_RENDER=1 bun test sidecar/preview/caption-render.test.ts`.
The installed `test/fixtures/render-smoke` runtime must include
`@remotion/captions` at the same version as Remotion. Set
`REMOCN_CAPTION_CAPTURE_DIR` to retain frames and the encoded clip.
