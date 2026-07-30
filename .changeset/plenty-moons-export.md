---
"remocn-studio": minor
---

Export the previewed composition to mp4 from the preview pane, rendered by the project's own
`@remotion/renderer`.

The render reuses the bundle the preview is already serving, so the file cannot drift from what is
on screen, and it refuses with a clear message when the project's `remotion`,
`@remotion/renderer` and `@remotion/bundler` versions disagree. Progress reports frames rendered,
then encoding, then the final combine; Cancel stops the render and removes the partial file, and
the finished `out/<Composition>.mp4` is revealed in Finder. One export runs at a time.
