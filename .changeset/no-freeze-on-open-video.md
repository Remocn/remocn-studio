---
"remocn-studio": patch
---

The studio no longer freezes as soon as a video is open. In 1.1.0 the shader
pane kept re-checking the open video's scene in an endless loop, which locked
the window on its first click and kept the helper busy until the app was
killed.
