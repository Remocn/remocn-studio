# Local CPU transcription fallback

Use when the WebGPU support probe fails. This recipe follows remocn's supplied
`get-a-transcript` guide and the `@remotion/install-whisper-cpp` implementation.
It needs Node.js, Git and a C/C++ build toolchain. Report missing prerequisites in
chat; do not silently switch to a paid service.

Install `@remotion/install-whisper-cpp` at the project's Remotion version. Decode
the selected audio track to a 16 kHz mono WAV with the project's Remotion ffmpeg:

```sh
npx remotion ffmpeg -i public/voiceover.mp4 -map 0:a:0 -ar 16000 -ac 1 -c:a pcm_s16le voiceover.wav
```

Use the original media for provenance. The example below transcribes the complete
source, so its timings start at zero. Select the correct language and model; use a
multilingual model such as `small` for non-English speech. `tiny.en` is useful for
a quick English smoke test; inspect accuracy before accepting its transcript.

Copy `caption-data.mjs` beside this project-local script:

```js
import path from "node:path";
import { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } from "@remotion/install-whisper-cpp";
import { sourceIdentity, publishTranscript } from "./caption-data.mjs";

const whisperPath = path.resolve(".caption-tools/whisper.cpp");
const version = "1.5.5";
const model = "small.en";
const language = "en";
await installWhisperCpp({ to: whisperPath, version });
await downloadWhisperModel({ model, folder: whisperPath });
const whisperCppOutput = await transcribe({
  inputPath: path.resolve("voiceover.wav"),
  whisperPath,
  whisperCppVersion: version,
  model,
  language,
  tokenLevelTimestamps: true,
  additionalArgs: ["--no-gpu"],
});
const { captions } = toCaptions({ whisperCppOutput });
await publishTranscript("src/videos/my-video/captions/voiceover-001", captions, {
  source: await sourceIdentity("public/voiceover.mp4", 0),
  startMs: 0,
  endMs: null,
  language,
  backend: `whisper.cpp/${version}`,
  model,
});
```

Stop on recognition or validation failure. Reuse a completed transcript on later
style changes. Preserve old transcripts and corrections; choose a new output
directory for a deliberate new transcription. Model installation and download run
once outside rendering. Keep them out of public assets and respect cancellation.
