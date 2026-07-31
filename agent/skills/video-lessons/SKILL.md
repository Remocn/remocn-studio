---
name: video-lessons
description: >
  Hard-won production lessons for Remotion video work — every rule is here because the
  opposite was tried and failed on screen. Read this BEFORE writing or editing any scene,
  animation, transition, text entrance, font load, shader, camera move or render command,
  and consult it again when something looks wrong (text jitter, empty frames at a
  boundary, a scene that renders blank or static, a font that silently fell back, a
  transition that reads as a slideshow). Covers standing style bans, text jitter, fonts,
  the Remotion timing model, TransitionSeries traps, boundary design, choreography, scene
  structure, brand fidelity, shadcn/CSS-in-video traps, shaders, rendering and
  verification. Prefer these rules over first instincts — they already cost a render.
---

# Video production lessons — every error and the decision that fixed it

Compiled 2026-07-30 from the full project memory of remocn-demo and its spun-off
repos (remocn-neon, remocn-activebuilders, launchfast). Every rule below exists
because the opposite was tried and failed on screen. Format: **error/symptom →
decision**. Intended as raw material for a system prompt for Remotion video work
(Remotion 4.x, 30fps, headless-Chrome renders).

---

## 1. Standing bans & style rules (user-established, non-negotiable)

- **Never append "+" to numbers or counters** ("130+", "42k+") — show the plain number. If a source tagline contains a plus, strip it.
- **No letter-spacing, no uppercase headlines, no badges, no pulsing, no install pills.** A brand's own wordmark tracking (e.g. remocn's −0.03em) is exempt. Spinners are glyph ramps (`·✢✳✶✺`), never scale pulses. Neutralize `animate-pulse` with `animate-none`.
- **No swirl and no ripple transitions.**
- **Physics over bezier fakes**: use Remotion `spring()` (damping/stiffness/mass) for element transforms; large grow/travel moves use ease-in-out (gather → mid acceleration → brake). The house slide grammar has **no bounce** (`overshootClamping: true` — the user wants spring physics but rejects visible overshoot). At most ONE deliberate overshoot per film.
- **Text entrances travel on X, never Y** (standing preference — see §2 for why).
- **Branded components and third-party logos keep their own colors** (see §9).
- **Transform and opacity never share a curve or a length.** Arrive and lock.
- **One accent color, spent sparingly.** Cohesion comes from a shared backdrop, identical framing, and consistent captions — never from a color wash.

## 2. Text rendering & jitter

- **Root cause of all text jitter**: browsers snap glyph *baselines* to whole device pixels; horizontal x-advances keep sub-pixel precision. The identical curve that ticks on Y is smooth on X. → Text entrances move on X (reference: `remocn/short-slide-right`), or don't translate at all.
- **Mechanism**: ONE `translateX` on the whole run/paragraph; the stagger lives purely in per-word *opacity*. Never per-word X travel — words share the line box and slide through each other ("Cloud primitivesfor").
- **Inline-block trap**: a transform on a span forces `display: inline-block` (an atomic box), which breaks two-tone inline paragraphs — one half wraps onto its own line. → Put the single translateX on the paragraph wrapper; keep inner spans plain, staggering opacity only.
- **When purging Y from a demo**, grep `translateY` and check every text-*bearing* container (console panels, terminal wells, captions, bylines) — not just the type primitives. Keep translateY only for non-text geometry; keep the camera (background scale) off type entirely.
- **Text inside a continuously-animated scale wrapper (Drift/CameraRig) trembles** — two distinct artifacts: a coherent ~1px row snap, and a finer per-glyph sub-pixel wave. Shipping fix: `willChange: "transform"` on the animated wrapper **plus rendering at `--scale=2`**. `rotate(0.05deg)` fixes the row snap alone but is slightly harmful once will-change is in place — don't stack them.
- **will-change only helps content at rest** — a text layer that is itself animating re-rasters every frame anyway. For translateY entrances with easing tails: **land the travel early** (~60% of the frames; opacity/blur keep the full curve) so every half-integer pixel crossing happens in the fast phase. Mirror it for ease-in exits (start travel late). Rule of thumb: while text translates, keep its speed above ~0.5px/frame, or don't translate text.
- **Refuted**: per-char split promoted layers — sixteen promoted text layers shimmer even at rest (0.40 jerk vs 0.00 plain). Worse than the disease.
- **Never animate layout `width` for a reveal** — width springs re-lay-out the row every frame and drag the largest type across fractional pixels. Keep wrappers at final size; do the choreography with transform + clip-path, and carry the re-centering with a compensating translateX on the row.
- **Measuring jitter**: jerk scan over a finished render — ffmpeg `format=gray` → luma threshold → `tblend=difference` twice → `signalstats`; rank frames by the spike. (Chain two tblends; `tmix` with negative weights clamps to zero. SAD trackers give garbage on fast motion.)
- **A centered line being "written" must reserve its full width from frame 0** (per-glyph opacity toggle) so it never re-centers mid-write.

## 3. Fonts

- **`@remotion/fonts` `loadFont()` at module scope silently does nothing** (its delayRender fires before any composition mounts; the promise dies — render proceeds in the fallback face with no error). → Load inside the composition: `useEffect` + `delayRender`, gate the whole tree on a `loaded` flag, and double-`requestAnimationFrame` before `continueRender` (otherwise stills race the screenshot and capture the fallback).
- **Judge font application only on full-scale stills** — at `--scale=0.5` a pixel font's stepped glyphs smooth out and look exactly like a Courier fallback.
- **Canvas-measured text** (letterform masks, mono advances): measure with canvas, never assume 0.6em; recompute after `document.fonts.ready` (behind a delayRender gate) or fallback-font metrics get memoized.
- **Canvas `textBaseline: "middle"` sits above a flex-centered DOM span.** Rebuild the DOM's math instead: alphabetic baseline at `H/2 + (fontBoundingBoxAscent − fontBoundingBoxDescent)/2`.
- **Licensed/vendored fonts (Typekit, Anthropic) load via `staticFile` only** — never republish them to the shared assets bucket (`demoAsset`).
- **Check glyph coverage of vendored faces** — auger-mono has no `→` (U+2192); missing glyphs fall back silently mid-line. Draw arrows/checks as SVG.
- **If a brand ships only Roman/400**, everything is `fontWeight: 400`; emphasis comes from size and color — the browser otherwise synthesizes an ugly bold.
- **System-font measurers under wide display faces overlap words** (kinetic-center-build). Pass `measureScale` (Cal Sans 64px ≈ 1.16; Geist 600 56px ≈ 1.1) and verify on full-scale stills. Cal Sans + `tabular-nums` renders the thousands comma at full digit width → drop the comma ("1200"), keep tabular-nums.
- **One-frame stills happily render in the fallback font** — thumbnail/still components must hold the render until fonts resolve (`waitUntilDone()` / `document.fonts`).

## 4. Remotion timing model

- **`useVideoConfig().durationInFrames` is scoped to the nearest `<Sequence>`.** Components that pace themselves off it (RollingNumber, AnimatedLineChart, GitHubStars) see the *scene* length — keep `speed≈1`. Setting speed 9–13 "to compress" made them finish in ~10 frames, hidden under the entry blur, i.e. apparently static.
- **`<Sequence>` rebases `useCurrentFrame()` to 0.** Components gated on ABSOLUTE scene-frame constants must not be wrapped in a Sequence — the gates never fire and the phase renders blank. Render them directly; they gate themselves.
- **`<Sequence>` renders an AbsoluteFill.** Inside a card/content box the parent must be `position: relative`, or it expands to the nearest positioned ancestor and overflow clipping silently stops (caption "written on the photo" instead of in its band).
- **`<Loop>` clips its last iteration to the parent's remainder.** Exit interpolates of the form `[exitStart, durationInFrames]` invert when the clipped duration < enter duration and crash the FULL render only (stills never hit the bad frame). → Gate with `hasExit = exitStart < durationInFrames`, or compute a local exit clock over `[0, exitDur]`.
- **`interpolate` inputRange must ascend** — a descending range throws only on the frames that actually hit it (e.g. dwell frames), invisible in spot checks.
- **`OffthreadVideo` must never be asked past its clip end** — freeze at `liveFrom + clipFrames − margin`.
- **Know your clip assets**: self-contained excerpts start at t=0 → NO `trimBefore`; manifest offsets are provenance only. Keep peak simultaneous video decoders ≈ 8.
- **transition-rail does not wrap scenes in a Sequence** — `useCurrentFrame()` inside a rail scene is the GLOBAL clock. Compute slot starts yourself and pass them down.
- **Frame-exact rebuilds need local clocks** — absolute `<Sequence>` per scene + settle primitives, not TransitionRail.
- **Naive odometer math** (`pos = value/10^place % 10`) leaves higher columns resting *between* digits whenever the final value isn't a multiple of their place. Use per-place travel: `pos = wrap10(startDigit + progress × travel)`, `travel = (fullTurns×10 + stepDelta) × dir` — every column lands on its final digit.

## 5. TransitionSeries & presentation traps (each cost a visible defect)

- **The ENTERING presentation stays mounted at `presentationProgress = 1` for the whole incoming scene.** Anything not exactly 0 at p=1 paints over the scene until the next cut: shader fields that only fade IN sit opaque behind the scene forever; an exit window running to 1.08 never clears; a wavefront projection that goes negative past 90° leaves every cell "ahead of the front". → Fix at source AND give every presentation an explicit tail guard (`interpolate(p, [0.9, 0.99], [1, 0])`), or tail-fade fields (`interpolate(p, [0.08,0.32,0.78,0.98], [0,1,1,0])`).
- **Never leave a composited no-op layer alive.** Full-frame mask/filter/clipPath wrappers "doing nothing" at p=1 are 3840×2160 layers at `--scale=2`; on some GPU/driver combos Chrome's tiling repeats the last drawn slice — the headline ghosts 2–3× to the right with a seam (reproduced under `bunx --bun`, not npx). → At p≥1 presentations return bare `{children}`; masks return `null` when complete. Bonus: ~33% faster render. Pin `--gl=angle` to kill driver variance.
- **The entering layer composites ON TOP of the exiting one** — "halves part to reveal the scene behind" silently inverts (the incoming covers the halves). Any reveal-from-behind seam must draw BOTH scenes itself every frame.
- **A scene that both enters and exits is wrapped in TWO presentations, with the EXITING one OUTSIDE.** A context Provider from the inner (entering) presentation wins while pinned at p=1 for the scene's whole back half → every exit silently no-ops. Nested boundary effects must COMPOSE (multiply opacities, concatenate transforms, intersect masks), never override. Hardest class of bug: both boundaries look correct alone. When plate and content need different rules at a boundary, hand-roll the sequencer (~30 lines) instead of fighting TransitionSeries.
- **Cover-style transitions leave a fully-legible headline under an opaque texture for ~⅓ of the boundary.** Rewrite covers as WIPES: one front crosses the frame; incoming completely clear behind it, outgoing completely clear ahead of it; the brand texture exists only as a narrow band riding the front; both scenes masked with the same gradient geometry from opposite sides.
- **Presentations have no local frame count** — run springs on a normalized reference clock: `vFrame = presentationProgress × REF_FRAMES`, then `spring({frame: vFrame - lead, fps, config})`.

## 6. Boundary design rules

- **A wipe front travels linearly** (or `bezier(0.42, 0, 0.24, 1)`). The house exponential puts the front 93% across by p=0.46 — reads as a flash, or as nothing at all (front already off-frame at the seam midpoint).
- **A wipe must mask the CONTENT, not just the plate** — masking only the plate over a content crossfade reads as a decorative band sliding over a dissolve. Both sides carry the same `linear-gradient` mask (complementary sides), driven by the same eased progress.
- **The mask must NOT travel with the content.** A CSS mask resolves in its element's own box and is then mapped through that element's transform — mask + translate on the same element puts the front on a different line than the ground's by exactly the travel distance. → Wrap every scene in TWO layers: outer carries the mask and is never transformed; inner carries opacity/translate/scale/filter.
- **A front with nothing behind it is a curtain.** A wipe *reveals*; it doesn't move anything. To have a boundary "pull" the next scene in, the content must LAG the front (drag ease slower than the front's ease) — a spring that finishes its travel early then waits reads as "arrived and stopped".
- **Masked reveals ride the crop box, not the full-size children** — masking the children exposes a band the crop window already cut away, and the frame goes empty mid-transition.
- **Seam occupancy**: never drive both halves off the seam's raw progress with a power curve — at the midpoint neither has visibly moved, and all travel happens while invisible. Each half runs its own full curve over overlapping sub-ranges (OVERLAP ≈ 0.42). Every incoming scene puts something on screen by its own frame 0–8.
- **Scenes a boundary REVEALS (wipe/lift/push) need content at local frame 0.** Scenes a slide carries in are blind for ~12 frames → give them an internal pre-roll `lead` (12–20f: `f = local + lead`) so the plate arrives mid-assembly, already moving. Scenes on either side of a HARD cut must be fully composed at frame 0. Best of all: static structure the plate simply carries — a plate that lands blank and then assembles itself is two events where the boundary should give one.
- **A composed scene is required by ANY boundary that travels it**: give it a clock independent of the lead, and no travel of its own — the boundary supplies all movement; a second translate on top makes the arrival mushy.
- **For any fade-based boundary, render a frame at p≈0.3–0.35 and confirm it is not empty.** (`lift` drops the outgoing at p=0.3 but reveals the incoming at 0.34 — an incoming plate with an invisible backdrop and a delayed headline reads as a cut to black.) Wipe-based boundaries don't have this failure mode.
- **The 3-phase gap (content out → plate crossfade → content in) is only needed when the GROUND changes tone** — a black↔white crossfade passes through mid-grey, so the plate must change while no content is on screen. Between same-tone scenes the gap buys nothing and costs ~5 empty frames. Symptom: a blank tile in the contact sheet exactly at a boundary midpoint.
- **The background must not travel in a slide** — translating the whole AbsoluteFill sweeps a hard flat-color edge across the frame (tears over a fine dotted field on a black↔white boundary). Split every scene into a pinned plate (color + field + grain + vignette + camera) and a travelling content layer.
- **Percentage translate on a diagonal is a trap**: `translate(x%, y%)` resolves x against width, y against height — a "100%" push along 45° on 1920×1080 leaves the incoming plate a quarter on screen. Full clearance needs ≥141%.
- **Sub-threshold cuts read as NO transition.** A 2-frame invert-cut (conceptually "the negative IS the logo") was rejected twice — below the threshold at which the eye registers an authored event, it just looks like the scene switched. A boundary that has to be explained before it can be seen is a caption, not a boundary.
- **Vary boundaries by DIRECTION, not by mechanism** (settle / drop↓ / slide← / rise↑ / slide→; no two adjacent share a direction).
- **Pick the grammar by TONE, not variety**: `settle` for big tonal jumps (its color change happens inside the empty gap frame); slide/rise only between scenes that already share a tone (a stage-color crossfade across a slide gives ~6 frames of washed mid-grey).
- **Longer boundaries eat dwell** — only `dwell − in − out` is screen time. A 64f transition next to a 66f scene leaves ~2 clean frames; budget LEAD/TAIL into the neighboring beats and grow dwells when replacing hard cuts with slides.
- **A count-up must not start before its own transition reveals the plate** (a count from frame 0 behind a slide was already at 106 when first visible). Start at the first visible frame; extend the dwell accordingly.
- **Match cut / seamless zoom recipe**: both contact surfaces the SAME flat hex at the crossover; incoming content gated until the transition lands; a blinking cursor goes solid before the dive; the camera must FREEZE before the dive (a still-moving camera smears the match). The rect math is 2px-fragile — count 1px dividers, use border-box headers, and remember a box-shadow ring isn't a border (a border grows the box and shifts the rect). If a preview "plays the film", give the inner film a LEAD offset so the player joins it already running.
- **A post-credits sting needs no new transition — `settle` already is one.** But the sting scene must not sit empty (~26 frames = 1.1s of black reads as "film over"). Give it an entrance unlike anything else in the cut (pure fade + a hair of scale; no travel, no stagger).
- **Mask-grow transitions over a shared backdrop**: scenes are transparent, so (a) a clip-path reveal needs its own surface fill, and (b) NOTHING may opacity-fade before it is physically covered — fading the exiting scene on raw progress exposes bare backdrop at the frame edges. Key every fade to the mask-coverage value (computed identically in both presentation directions); make every last-to-leave layer backdrop-colored. If the backdrop is a live shader, flat-color covers kill the field — pass the backdrop STACK as a prop and let covering layers re-render it (a second shader instance is frame-identical, so hand-offs are pixel-invisible).
- **Complementary-clip transitions require transparent scenes** — both sides must let the shared backdrop show through the clips; a solid scene background breaks the illusion.
- **One transition language per film; spend `fade` once** (at the final lockup). Four fades out of seven cuts reads as a slideshow. Don't reset the camera at cuts — one continuous CameraRig on the absolute frame is the connective tissue (keep it subtle; big global zoom = nausea). One shared glow/grain palette, not three competing ones.
- **Clip-path portals are wrong for "fly through + approach"** — the incoming logo draws clipped inside the shape then pops when the mask clears, and the outgoing scene's own shape reads as a second copy. Fly-throughs are: outgoing self-dives (scale at the aperture's origin) until its interior swallows the frame, then the incoming approaches out of that ground (scale up + unblur).

## 7. Motion & choreography

- **The settle standard** (user-tuned, "the standard for all videos"): exit = whole scene shrinks to ×0.84 over 6f, pow5 ease-in, AS ONE GROUP — per-element scaling makes multi-line text drift apart (line boxes keep height while glyphs shrink); ~1 empty gap frame, bg crossfades ~4f centered in it (content never crossfades, only bg); enter = items from ×1.24, spring d30/k320/m1, opacity in ~5f, staggered ~3f; a multi-line text block is ONE item; scenes hold perfectly still between transitions (no Ken-Burns dwell drift).
- **The slide standard**: strictly sequential, never overlapping (concurrent A/B ghosts). A shoved 10% of the axis, pow5, 22f, fully hidden by an accelerating t² fade inside its own tail; B springs in from 28% with d60/k300/m0.5, overshoot-clamped; fade-in 24f decelerating; one shared canvas color for the whole run.
- **An exit is never an entrance reversed** — the asymmetry is about curve and length, not direction. A TRAVELLING shot must leave on its own vector (still shorter than the entrance, and accelerating where the entrance settled).
- **An arc has a source; a fade does not.** Fade-and-scale has no direction, weight, or source — five in a row are five identical nothings. Build tosses from ONE flight parameter (x eased-out; vertical hump = `4t(1−t)` of the same parameter); rotation gets its own springier curve so the spin settles AFTER the position lands. Two separately-timed animations that "happen to look like an arc" drift apart on the first retune.
- **Ambient cycles need non-harmonic (mutually prime) periods** — 8/10.5/13 frames, or 29/31/37/41/43. Harmonic sets re-sync within two cycles and read as a metronome/pulse.
- **`floor((local − offset)/period)` starts at −1 for offset rows** — the cycle opens on its LAST item then jumps. Anchor the index to the first event.
- **Stagger direction carries meaning**: growing gaps (power ~1.3) for failures/exits; compressing gaps for arrivals.
- **Depth swaps** ("one socket, changing occupant") beat lateral ejects (which read as two different places). Blur must be TIED to scale — softening without shrinking reads as a focus defect; softening AND shrinking reads as depth. Cap blur ~11px. Never park a visible low-opacity stack behind at rest (a dim logo behind a logo is a smudge, not a deck) — depth exists only during the swap.
- **Animate the mark's OWN parts — never a substitute, never spawned copies.** (Corrected twice: hand-drawn lines → particle copies of the parts → the mark's own three streaks sliding on three periods.) The firing state and the finished mark are the same objects at different values of one parameter — nothing to hand over. Feed all layers the identical geometry or the hand-off seams.
- **Hand pixels over with a mask, never a crossfade**, when one layer must *become* another (radial-gradient `maskImage` with radius = flood progress) — fading greys the parts the flood hasn't reached.
- **Remove a superseded layer only when its replacement fully covers it** (the ring stays until the disc reaches its radius, else two circles are on screen).
- **Still geometry ≠ a still frame.** When a held beat feels dead, send something ALONG the geometry before agreeing to move the geometry (a signal bar running the wires; the card acknowledges with border contrast only — nothing moves a pixel). SVG recipe: `pathLength={1}` normalizes dash math across paths of different lengths; dash gap > path length guarantees exactly one bar (no wrap-around chase); run `strokeDashoffset = SEG − t·(1 + SEG)`; fade both ends of the run; guard the arrival tick with `since < period ? 0 : …` or every card ticks at frame 0.
- **Make a consequence, not a second animation.** The mark's leftward travel = flexbox re-centering as the wordmark's `maxWidth` opens from 0, not a matched translate. A panel's squeeze = its edge as the running sum of the neighbors' animated widths.
- **Structure before content**: a hairline draws, then content arrives into the box it made — a free "reveal" in the back half of the beat.
- **Camera continuity is C1**: dwell drift must ease in-out so velocity is zero at every dwell↔hop joint, or the whole take judders. `filter` is a grouping property that FLATTENS `preserve-3d` — motion blur must live on an ancestor of the perspective element. Cull fly-past objects early (relZ ≈ −140/−150): projected scale is hyperbolic in depth, and an object visible past that explodes several × per frame and reads as camera shake.
- **One-take grammar**: no transitions at all — still camera on a tile while it plays (zoom exactly 1 = pixel-crisp), sin-eased pull-back glide between tiles, scenes start `LEAD ≈ 34` frames before the camera lands (mid-glide the next monitor is already waking), finished scenes freeze on their last frame. Blur from SCREEN-space speed (world speed × zoom).
- **Zoom rigs**: additive springs in the log-scale domain keep overlapping beats continuous; dive targets need a small overshoot past the exact fit (2.0 → 2.1) or the last percent leaves a border seam; anticipation = a tiny opposite-direction segment ~8f before the dive; screen-space chrome divides by the projected scale so 1px stays 1px; SVG contour draws under scaling need `vectorEffect="non-scaling-stroke"` (else stroke-width is in viewBox units, ~4× fat).
- **Stop-motion (quantized clock)**: per-pose displacement stays ~a hand-width — spring settle time ≥ ~20 poses for desk-scale travel, or it reads as glitching; stagger mass arrivals into waves (1–2 items per pose) and delay the camera move until the first wave is airborne. Smooth-clock video *inside* the stop-motion world is a legitimate contrast when it's the concept.
- **Path morphs**: `interpolatePath` figure-eights on winding/start-phase mismatch, and `reversePath` alone doesn't fix it. Resample both closed glyphs to fixed-N rings, normalize winding by shoelace sign, rotate the target ring to the min-squared-distance phase, lerp points. Order morph chains by silhouette similarity; every post-morph action starts AND ends at identity so hand-offs never jump.

## 8. Scene & story structure

- **Empty frames at frame 0 are the most expensive mistake a 30s cut can make.** The FIRST scene's internal clock starts at ~0 regardless of any boundary lead, and its first element takes a negative `at` so frame 0 is already non-empty.
- **Land the last frame — the outro has NO exit.** The final frame is a frame someone screenshots; flying the mark off reads as a glitch. Drop the URL when there's nothing left to say (a fourth thing to read is noise).
- **One close carrying five things is five things read past.** Split the close (price / rating / outro); the strongest number in the pitch deserves its own scene, not a subtitle.
- **A viewer reads a repeated diagram as repetition, not a rhyme** — however carefully the second shot inverts the first. If a shot pays off twice, it spends its surprise the first time. Cut the setup beat.
- **A shot containing only type cannot hold ~50 still frames** — past ~20 the viewer stops reading and starts waiting. Long holds need a second element in frame.
- **Never show a heading and its visualization in the same scene** — the heading gets its own breaker scene.
- **Labels on a filling bar ACCUMULATE, never replace** — swapping them orphans every filled block and reads as the frame losing information.
- **Tight dwells after a progress bar completes**: ~16–20 frames, then move. Idle beats grow back silently — watch for the ~2s "hang".
- **Don't open with text** — the opener is the marks assembling, motion first.
- **Rebuild the product's OWN signature components and animations, never abstract metaphors.** Two full cuts were deleted as "nothing to look at" (a button pressing itself, a styles grid); the fix was porting the product site's actual demos with their actual labels. Metaphor scenes are the first thing a client kills.
- **Don't demonstrate features that don't exist** (Export ships disabled → it's drawn but never demoed; the outro says "early prototype").
- **A build is one clock.** Don't split a logo build across a match cut — the ring fills, the rocket levitates inside it, the arc closes under the flight, floods to the disc, wordmark opens: one continuous object. (A hard cut failed three times on one brand — stop proposing hard cuts there.)
- **Confirm the axis before building** — "друг под другом" meant stacked along Z (overlapping), not a vertical column.
- **Best-on-paper ideas fail on screen.** The invert-cut and the split logo build were both defensible in prose and both read as broken. WATCH the render (or contact-sheet it) before defending an idea; reasoning about a boundary is not seeing it.
- **The changelog-series formula**: each release debuts exactly ONE new transition that *performs the release's meaning*, used exactly twice; the outro is inherited verbatim from the flagship film.
- **Galleries**: the user rejects camera scrolls over grids/carousels (blank frames, unwanted movement) — fixed center card, items stacked on Z, each blooming over the previous via a center-out clip-path (`inset((1−p)·50% round 16px)`).

## 9. Brand fidelity & research

- **Branded components keep their OWN colors** — never wash `claude-*`, `chat-gpt`, `v0`, `opencode`, `x-*`, provider logos, or any vendor mark into the video's palette; never override their `accentColor`. Being recognizable as that product is the entire point; a wash shows the video's art direction instead of the release. The only justified intervention is *legibility*: a light-hardcoded component on a dark canvas gets `invert(1) hue-rotate(180deg)` (flips luminance, restores hue). If a treatment is truly unavoidable, use CSS `filter` — never `mix-blend-mode` (blending paints solid over transparent component roots). Their THEMES are shared module constants — never mutate them.
- **Read the brand off the LIVE compiled stylesheet** (palette, type scale, radii, tracking, weights) — and expect source comments to lie ("matches #141318" over a token that computes to #09090b; the 1-token gap was load-bearing).
- **Decode assets — never trust filenames or fetch summaries.** "purple-icon.png" contains no purple pixel; a WebFetch summary will confidently call it a purple brand.
- **Real logos verbatim**: inline the site's actual SVG paths; if only a raster exists, trace it (threshold → connected components → Moore boundary → Douglas-Peucker). Never redraw by eye. Don't "fix" authentic quirks — the slanted parallelogram `I` in "BY ANTHROPIC" is the brand, not a bug. Omit raster-only marks rather than embedding mush.
- **Mine the brand's own geometry for the motion language** (the repeated THE FIND pattern): Neon's icons are a quantized dot lattice (k/11·P) → the lattice animates and can *become* a diagram; the activebuilders logo is 3 separate solids on an exact 60° → assembly IS the story; the LaunchFast mark is a rocket + three 45° streaks → the brand had a motion axis before any motion; `border-dotted` promotes to a dot-lattice ground with two readings. Assets drawn for 56px chrome don't scale to hero beats — re-author at beat scale.
- **Spend the accent the way the site does** (often: almost never). Don't import a second typeface when the identity has one. Don't invent a palette for a monochrome brand — "the color is what you plug into it."
- **Lockups: match SYMBOL heights, not letter heights** (measured: Neon caps = 0.605 × symbol height). Guidelines forbid reconfiguring logo proportions; let the letters land where the real logo puts them.
- **Positioning moves** — re-verify the live homepage copy and CLI commands at build time (`npx neon@latest init`, not the old film's `npx neon init`); never reuse an old script.
- **Two products can share a name** — verify which one the film is about before writing a line.
- **Docs go stale**: SCRIPT.md/STORYBOARD.md frame numbers drift after edits. The `*_DURATION` constant in `index.tsx` is the only source of truth.

## 10. shadcn/ui, HTML UI & CSS-in-video traps

- **shadcn `transition-*` utilities run on WALL CLOCK, not the frame clock.** A hard theme/var flip starts a real-time CSS transition and the frame screenshot catches it mid-flight — nondeterministic in-between colors, adjacent frames disagree (a button strobed through six greys). → `.video-scope * { transition: none !important; animation: none !important; }`. Verify with pixel samples from CONSECUTIVE frames (`--sequence` render + ffmpeg 1×1 crop) — stills cannot reproduce it (a direct seek mounts the class already applied, so no transition fires).
- **react-day-picker's "today" follows the render-day wall clock** → nondeterministic across days. Always pass `today={...}` alongside `selected`/`month`.
- **Portal primitives (open tooltip/dropdown/dialog) escape camera transforms** — under transformed planes use inline-rendering components only (Command, Calendar, Accordion).
- **Regular-weight rule over components that ship font-medium/semibold**: `**:font-normal!` on the wrapper (Tailwind v4 all-descendants + important).
- **Dark-first `global.css` leaves `:root` without `--background`/`--foreground`** → any light-theme render paints transparent where background is expected (a checked Switch = solid black pill, invisible thumb). Both var sets must exist in `:root`.
- **CSS-var pins do NOT stop inherited computed styles.** A `--font-sans: var(--font-sans)` self-reference broke the html font and serif leaked INTO the pinned subtree. Declare `font-family` on the scope element itself. Pinning identical values can't prove scope-correctness — only a diverging theme exposes holes; byte-compare stills against a pre-change baseline.
- **`text-indent` INHERITS, and an inline-block is a block container** — a heading's first-line indent re-applies in front of every animated word span (~80px gaps). Word spans need `textIndent: 0`.
- **Word gaps between animated spans are `marginRight`, not a space character** — a trailing space in a `white-space: pre` inline-block doesn't collapse.
- **Registry typography components render `position: absolute; inset: 0` centered and read `var(--font-geist-sans)`** — set the var on the composition root (or they fall back to system), and give each line its OWN positioned box (they can't stack in normal flow). Per-char effects need `speed ≈ 2.2` to finish a long line inside a scene.
- **Primitives that hardcode the light theme** go on a small light Stage card when the film is dark — don't recolor them.
- **GlassCodeBlock's tokenizer mangles number literals**: `60_000` → `,` and `-0.025em` → `-0.;`. Keep code samples to clean literals (`600000`, `font-weight: 700`) and verify every code window on a rendered still, not a typecheck.
- **RollingNumber's root is an AbsoluteFill** — dropped into a flex child it anchors to the nearest positioned ancestor and centers over the whole scene. Wrap in a `position: relative` box with explicit width/height (~`0.62em × digits` × `fontSize × 1.1`) + `overflow: hidden`.
- **Translucent cards over live/moving content are unreadable** — a `rgba(255,255,255,0.075)` permission card over a scrolling transcript let the diff read through. Flatten to a solid; give the container `overflow: hidden` and pin content with flex-end.
- **~1000 absolutely-positioned per-glyph spans lag Studio** — per-glyph particle scatter was rejected for it; keep DOM particle counts down (canvas/SVG for swarms).
- **Terminal scroll is a smooth ~10-frame eased glide, not an instant snap** (the hard 360px teleport read as janky); overlapping glide windows compose additively. A CTA caret renders only once the command starts typing — no caret idling on a bare `$`.

## 11. Shaders, WebGL & three.js

- **Everything WebGL renders black or throws in headless Chrome without `--gl=angle`.** Now repo-wide via `Config.setChromiumOpenGlRenderer("angle")` — but `remotion.config.ts` applies to the CLI and Studio ONLY: Node-API scripts must pass `chromiumOptions: {gl: "angle"}` themselves. Also `remotion.config.ts` is in tsconfig's `exclude` — typecheck it explicitly after editing. A looped shell command can exit 0 while the still silently fails — check the output file actually landed.
- **ShaderLiquidMetal renders a rounded card, not fullscreen** (even with `shape="none"`); god-rays/warp/mesh-gradient/voronoi/metaballs fill edge-to-edge.
- **Dither dissolves need `shape="simplex"`** — the default `wave` fills half the frame with solid colorFront.
- **Grayscale ripple tunnels are nearly invisible with color-preset values** — hold `scale` low (0.22→0.55 through the readable window) and `intensity ≈ 0.8`; and since the entering child is hidden until p≈0.86, any draw-on inside the incoming scene must START at that reveal or the animation is spent behind the cover.
- **Voronoi as a statement cover**: mid-brightness cells read as loud stained glass. Near-black tinted cells, gap ≈0.07, `colorGlow` = the background hex (darkens cell centers), animate `scale` for the bloom, tail-fade the field.
- **Caustics: the filaments are the ZERO-CROSSING set** — light them with `exp(-abs(c))` (sharp core + soft halo), not `pow(clamp(c,0,1), k)` (a flat grey gradient with no veins).
- **three.js inside Remotion**: pass `flat` on ThreeCanvas or ACES tone mapping lands a calibrated light rig ~40% dark; fix SVG y-down with rotation `[π, 0, 0]`, never `scale(s,−s,s)` (mirrors windings/normals); mount ThreeCanvas for the WHOLE scene (a conditional mid-scene mount flashes black on context creation); drive the camera by mutating it in render from `useCurrentFrame` — `useFrame` flickers; `style={{backgroundColor: "transparent"}}` composites over DOM shader fields; TubeGeometry + `setDrawRange` walks a stroke like an SVG dashoffset; scale grid slots by `(CAM_MID − z)/CAM_MID` so depth layers project onto one clean grid.
- **Glossy sheen over near-white glyphs**: pure white is invisible on #f2f2f2 — the band needs dark shoulders (shadow–highlight–shadow). Sheen is white, never the accent color.
- **No rigid-body physics package exists for Remotion** — deterministic physics = `@remotion/noise` + analytic kinematics.

## 12. CSS & layout traps (generic)

- **A CSS value containing newlines is dropped whole by the CSSOM** — a pretty multi-line template-literal gradient renders as *nothing*. Build gradients on one line; clamp stops to [0,100] and keep them monotonic (violations also void the declaration).
- **`linear-gradient(Adeg)` aims the AXIS; the bands run perpendicular** — a 60° front takes `60deg`, not `90 − 60`.
- **Decorative marks along a wipe front: scatter in screen space, then project onto the gradient axis with CSS's own formula** (`|W·sinθ| + |H·cosθ|`, centered on the box). Placing marks in (along, across) coordinates and inverting puts the band on a different line than the mask.
- **A `gap` on a flex row whose last child is zero-wide still occupies layout** — the row centers offset by gap/2. Put the gap INSIDE the clipped box as `paddingLeft`.
- **`clipPath` doesn't shrink the box** — a lockup mid-reveal sits centered on its FINAL width with a hole beside the mark. Translate the group by half the still-hidden width. (`maxWidth` animation genuinely shrinks the box and re-centers for free — but never animate width where text jitter matters.)

## 13. Rendering, verification & process

- **Ship render**: `npx remotion render src/remotion/index.ts <id> out/<id>.mp4 --scale=2 --crf=15 --x264-preset=slower --jpeg-quality=95 --gl=angle`. `--scale=2` is not optional — fine-stemmed type breaks up at 1× under H.264, and a 1px accent rule disappears into subsampled chroma (accent rules ≥3px).
- **Background renders lie twice**: batch completion notifications fire EARLY — monitor the output file, not the task. And killing the task kills only the shell wrapper — the render process SURVIVES and keeps writing; starting a replacement render to the same path interleaves two writers and corrupts the mp4 (Invalid NAL unit spam). `pkill -f "remotionb render"` and re-check `pgrep` before re-rendering.
- **`ffmpeg -ss` before `-i` seeks to keyframes** — for exact frames use Remotion `--frames=a-b --sequence`.
- **Contact sheet in one line**: `ffmpeg -i video.mp4 -vf "select=not(mod(n\,24)),scale=320:-1,tile=6x7" -frames:v 1 sheet.png` — it catches empty boundaries, blank openings, dead frames. But the tile grid PADS MISSING TILES WITH BLACK — trailing black tiles are not a fade-to-black (misread twice).
- **Probe-color verification beats inference**: to learn each scene's true span, swap every scene for a solid probe color, render `--scale=0.1 --sequence`, read the pixels. Inference from frame counts was wrong three times.
- **Verify on pixels, not on types**: code windows, fonts, seam midpoints (p≈0.3), transition frames, count-up values differing across frames — all on stills or sequences. Renders are deterministic with `--gl=angle`, so byte-comparing stills against a baseline is a valid regression check.
- **A pipe masks an exit code**: `tsc | tail -20` reports the pipe's status — "typecheck passed" was false. Diff error COUNTS against a stashed baseline (`git stash -u`) instead of trusting piped exit codes.
- **YouTube covers**: hard 2MB cap (ship heavy gradient art as JPEG ~92). Before touching a cover that "looks blurry on YouTube", open `https://i.ytimg.com/vi/<VIDEO_ID>/maxresdefault.jpg` — if that's sharp, the desktop grid is just serving a small derivative upscaled on hi-DPI; no re-render changes which derivative is picked (several wasted rounds). Reproduce compression artifacts locally (`scale=480 -q:v 7`, scale back up) instead of theorizing. Real finding: large smooth near-black gradients do block up under YouTube-grade compression; flat grounds stay clean.

## 14. Repo, registry & infrastructure

- **A standalone demo living inside the parent repo must do three things**: (1) its `index.tsx` re-exports the composition component directly, past the standalone `registerRoot` entry; (2) DELETE the nested `node_modules` — a second copy of `remotion` gives every hook its own React context and `useCurrentFrame` sits at 0 forever: a **still film with no error**; (3) NO `staticFile` — it resolves against whichever project's `public/` is serving; inline assets as base64 data URIs.
- **Check for squatters before building**: untracked stock templates with their own `package.json`/`node_modules` at the target path, including case-variant folders on macOS's case-insensitive FS (`Introducing-neon` vs `introducing-neon`). Move them away first.
- **The parent tsconfig may be stricter** (`noUnusedLocals`) — standalone code surfaces new errors only once registered.
- **`scan-demos.mjs` greps `from "…"` for package names** — a prose comment containing `from "to top"` injects a junk npmPackage. Don't write `from "x"` in comments.
- **`demo-meta.json` is generated — never hand-edit.** Registration flow: `catalog.ts` → `index.ts` (keep `...getCatalogEntry()` immediately before `component:` for the build-registry regex) → `scripts/frames.mjs` (thumbnail frame) → `node scripts/scan-demos.mjs`.
- **Every demo id needs its own `src/demos/<id>/` folder** — the site does `readdirSync` on it and crashes otherwise.
- **Pin `remotion`/`@remotion/*` (and `@remotion/tailwind-v4`, `@remotion/three`) to the same EXACT version** — caret ranges get bumped by `shadcn add` installs → "Multiple versions of Remotion" build failure.
- **Never "fix" lint inside `src/components/remocn|ui`** — any edit flips the registry item from URL-dependency to bundled. Relax eslint for those dirs instead.
- **Assets/fonts served cross-origin need CORS** (raw.githubusercontent sends `ACAO:*`; `python3 -m http.server` doesn't). Only `REMOTION_`-prefixed env vars reach compositions — and the Node bundler API reads NO `.env` at all, so env-based asset overrides never reach script-driven renders.
- **Node render APIs ignore `remotion.config.ts` entirely** (alias, tailwind, gl) — every render script re-declares them. Bundle ONCE for batch stills; `remotion still` re-bundles the whole project per call.
- **Vendor registry components by `cp`** — registry sources already use `@/components/remocn` + `@/lib/...` paths, so copies resolve unchanged.
- **Studio prop sliders**: give the Demo a zod `schema` and pass literal `defaultProps = schema.parse({})` in Root.tsx, or Studio Save doesn't work.

## 15. External tools

- **Paper (MCP canvas) renders a CSS subset and drops the rest silently**: `right`/`bottom` ignored (compute `left`/`top`); `repeating-linear-gradient` and all 3D transforms don't render (use inline SVG — it also clips overhanging strokes to its viewBox for free); no grid/margin/tables/inline — flex + padding + gap only; SVG `<g>` groups can't be appended incrementally (write each group in one call); the free tier has a weekly per-ACCOUNT quota that parallel agents drain; `export` names files after artboards — name artboards as the desired filename.
