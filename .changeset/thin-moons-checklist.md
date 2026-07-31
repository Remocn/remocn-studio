---
"remocn-studio": minor
---

Check the environment when a folder is opened, and say what is wrong above the composer instead of
letting it fail as a blank pane or a stack trace.

The checklist covers the things the app depends on but does not own: whether Claude Code is logged
in, which bun is running the sidecar, whether the folder is a Remotion project, whether its
dependencies are installed and agree with the lockfile, whether a Remotion entry point is
registered, and — once the preview has compiled — whether any composition is registered and whether
one of them is called `Main`.

Only being logged out locks the composer, because that is the one failure that would otherwise
happen on send. Missing dependencies can be installed from the card, with the output streaming as
it runs. Everything that passes is silent: the card renders nothing at all once there is nothing to
act on, and it re-runs on opening a project, on Recheck and after an install — never per message.
