# Applying a Studio caption selection

A Studio caption reference names an already-copied remocn implementation. Read its
props and use that component, even if the generic display guide suggests Basic
Captions. Do not search the online catalogue or rebuild the effect. Registry files
are source code; demonstration fixtures are not the user's transcript.

## Source and scope

Use explicitly referenced media and scenes first. Otherwise inspect the current
video. A single unambiguous voiceover needs no extra question. Ask in chat when
there are multiple candidate speech sources or several styles without an assignment.
With no speech or timed transcript, request it; do not invent dialogue or synthesize
a voiceover. For Speaker, use supplied speaker metadata; no diarization is implied.

A request containing only one caption reference means apply it to this video's
speech. Several references can describe different scenes; never stack them all on
the same voiceover without that intent.

## Reuse before recognition

Read existing transcript data and provenance. Check the original media SHA-256,
audio track and timing origin, not just the filename. Preserve corrected words
when the source is unchanged. Changing style, colours, placement, trim or scene
start does not in itself need recognition again. A segment transcript is reusable
only within its recorded source interval.

Use actual word timestamps for active-word effects. An ordinary SRT gives line
timestamps: it works for Subtitle but does not provide word timing for Karaoke or
Prosody. If word timings are needed, recognize the source; never divide a line's
duration evenly over its words. Preserve whitespace in caption text.

## Local recognition

Use the project's package manager and pin Remotion packages to its installed
`remotion` version. Do not upgrade the project silently if that version cannot
support the selected component or recipe. Installation and shell execution follow
normal permission cards. Explain model preparation in chat.

Read [the WebGPU recipe](../../remotion-best-practices/remotion-captions/transcribe-captions.md). Probe support in a separate Node.js process before downloading
the model. A native adapter probe may terminate the process instead of returning
JSON; treat a nonzero exit or missing adapter as unavailable and use the CPU
fallback. Run its Node.js script once outside rendering, using a language from the
request or known source context; ask when the backend requires a language and it
is unknown. The model's language must match the speech, including Ukrainian and
other non-English sources. Do not use an English-only model for those sources.

If WebGPU is unavailable, use [the CPU fallback](transcribe-local-cpu.md). If local
recognition cannot run, report the reason and ask for a timed transcript or the
missing setup. Never silently send media to a cloud service. If the user stops or
denies preparation, do not claim completion or wire partial data into the video.

## Save a complete transcript

The sibling `caption-data.mjs` provides `sourceIdentity`, `validateCaptions`,
`matchesSource` and `publishTranscript`. Copy it into a project-local script folder
before importing it so execution stays within the project. Use `sourceIdentity`
on the ORIGINAL media, not its temporary WAV. Record the chosen audio track,
segment start/end if extracted, language, backend and model. Store source-relative
timings; when recognition ran on a segment, offset its timestamps once by the
segment start before publication.

Publish into a new directory under the video's source folder, for example
`captions/voiceover-001/`. It contains `captions.json` and `source.json`. Publication
validates first and renames the complete directory into place; it refuses to replace
an existing directory. Reuse existing data without rewriting it. Give a new source
or transcription attempt a new directory; preserve the old valid transcript until
the new one is verified and connected. Do not leave model downloads or temporary
WAV files inside the render's public assets.

## Apply and check

Read the selected component's actual props. Its `captions` array uses milliseconds
relative to the surrounding Sequence. For a clip trimmed at source `trimMs` and
played at rate `rate`, transform each source timestamp with
`localMs = (sourceMs - trimMs) / rate`. Filter captions wholly outside the source
interval and clamp partially visible ones. Put the caption overlay in the same
scene-local Sequence as the clip; its outer Sequence supplies the scene's global
offset. Do not apply that offset again to the local transcript.

Place the text block within the video's bounds with readable contrast, margins and
line length. Keep the supplied renderer, including any props for keywords, emoji
or speaker colours. Rendering reads saved JSON; it never runs speech recognition.

Check early, middle and late spoken words, a pause and any trim boundary. Verify
Preview and Snapshot, then a short Export with the same saved data. A dependency or
render failure is an incomplete caption operation: explain it in chat, retain
usable data and resolve it before claiming success.

For segment reuse, pass the desired source interval as the third argument to
`matchesSource`; it rejects intervals outside the saved segment. Without an
interval it checks for a complete-source transcript. An optional fourth argument
to `publishTranscript` is the preparation script's `AbortSignal`; check it before
recognition steps too. An aborted publication never connects partial data.
