---
"remocn-studio": patch
---

The canvas preview no longer fails with a SyntaxError when the project recompiles while the preview is loading the previous version — it always loads one whole build. A project whose code builds a source map comment in a string loads again.
