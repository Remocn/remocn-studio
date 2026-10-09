---
"remocn-studio": minor
---

Add any of the 23 bundled shaders from the Shaders library directly to a video scene and edit its colors, motion, timing, pattern and individual parameters in Inspect. The catalogue includes 19 Paper shaders and Caustics, Strata, Weave and Light Tunnel. Image-capable shaders currently use procedural shapes. Insertions show progress, support retry and Undo, and wait for the preview before Export becomes available.

Videos created with Studio 1.0.0 can prepare their scene structure without a creation-version file. Recognised scene layouts update automatically when adding a shader. Other managed videos offer a separate Prepare video action using the selected agent, with an isolated working copy, source checks, compilation, preview validation and recovery. Recorded creation versions older than 1.0.0 remain unsupported. Preparation preserves existing Inspect values and does not create a shader instance.

Agent preparation can repair structural and compilation errors through up to three checked attempts, including videos that use custom scene wrappers.

Fix native WebKit preview and GPU-backed export for Caustics, Strata and Weave, including copies already saved in projects. Both compilers align shared uniform precision without changing saved shader files or values.

Allow shader insertion when an existing descriptor has identical JSON data with different formatting or key order. Preserve the file and continue rejecting changed controls, defaults and implementation versions.
