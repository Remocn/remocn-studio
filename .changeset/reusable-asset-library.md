---
"remocn-studio": minor
---

Save an asset once and reuse it in every other video.

The library lives in a drawer at the bottom of the left pane — one quiet strip
with a count that opens upward into a grid of thumbnails, the way the plan
drawer opens out of the composer. Closed, the sidebar looks exactly as it did
before assets existed. It holds images, video, audio and finished Remotion
components. Drag or click one into the composer and it lands
as `[Asset #N]` — a third reference kind beside `[Image #N]` and `[Element #N]`,
with the same chip, card and renumbering. On send the sidecar copies the files
into the project *before* the turn — media into `public/library/`, a component
into `src/library/<slug>/` — and the prompt says where everything landed, which
npm packages are missing, and that an existing file was left untouched. So the
agent spends no tokens retyping code, raises no permission card reading app
data, and an edit it made in an earlier turn survives.

Saving media is a click: an icon on the attachment card, or a card above the
composer when a turn that carried pictures ends. Content-hashed, so a file
already saved or already declined is never offered again. Saving a component is
the agent's job — it wrote the code and knows the import graph — through a new
in-process MCP server, `remocn-library`, whose tools are auto-allowed the same
way the pipeline's are. Two shortcuts write the phrase for you: a *Save to
library* button on the Inspect comment card, and one in the composer's + menu.

The library lives in `app_data_dir`, as `assets/<slug>/` plus a `manifest.json`
whose Schema is in `shared/`, so listing is a folder scan and previews load over
the asset protocol for free.

**Video and audio come in two ways.** The composer's + menu now takes them
beside pictures, and the Assets tab accepts a drag straight from Finder. A
picture still travels to the model as an image block spliced at `[Image #N]`; a
video or a sound cannot — the API has no such block — so the sidecar copies it
into `public/library/` before the turn and hands the agent the `staticFile()`
path instead of the one on your disk. That keeps `[Image #N]` meaning what it
has always meant, and makes an attached clip usable rather than silently
dropped. Both kinds carry the same save-to-library icon, and both are offered
by the end-of-turn card.

**The library is a grid of thumbnails.** Two columns of cards — the picture
over its name, with the clip's length badged in the corner — instead of a list
of rows wearing type icons. Hovering a card reveals a Delete button, which
takes the tile away at once and the folder only after an undo window, the way
deleting a session already works.

A video shows its first frame and a sound shows its waveform. Both are decoded
once, when the asset is saved, and filed beside it as a picture, so the panel
draws ordinary images and a library of thirty clips decodes none of them to
list itself; anything saved before this existed is filled in the first time you
open the tab. The length comes from the same decode, so the badge costs nothing
extra. Cards in the composer, and any video whose frame is still missing, fall
back to seeking the video itself — frame zero is the one time a `<video>` will
not seek to, so it asks for a tenth of a second in.
