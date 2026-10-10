---
"remocn-studio": patch
---

Quitting the app, or the studio's helper stopping, no longer files a "broken pipe" crash report. A helper process whose parent has gone now stops on its own straight away instead of carrying on with no one listening.
