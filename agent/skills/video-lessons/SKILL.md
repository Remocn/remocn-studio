---
name: video-lessons
description: >
  Hard-won Remotion production rules — every one is here because the opposite was tried and
  failed on screen. Read BEFORE writing or editing any scene, animation, transition, text
  entrance, font load, shader or render command, and again when something looks wrong: text
  jitter, empty frames at a boundary, a blank or static render, a silent font fallback, a
  transition that reads as a slideshow, motion that reads as cheap. Prefer these rules over
  first instincts — they already cost a render.
---

# Video production lessons

**Symptom → decision.** Remotion 4.x, 30fps, headless Chrome, `--scale=2`.
Every rule here is the second answer; the first one is what failed on screen.

---

## 1. Standing bans (non-negotiable)

- **Never append "+" to a number** ("130+") — plain number, and strip the plus if the source tagline has one.
- **No letter-spacing, no uppercase headlines, no badges, no pulsing, no install pills.** A brand's own wordmark tracking is exempt. Spinners are glyph ramps (`·✢✳✶✺`), never scale pulses; kill `animate-pulse` with `animate-none`.
- **No swirl and no ripple transitions.**
- **Physics, not bezier fakes**: `spring()` for element transforms, ease-in-out for large grow/travel moves. The house grammar has **no visible overshoot** (`overshootClamping: true`); at most ONE deliberate overshoot per film, normally spent on §7's per-word text build.
- **Text entrances travel on X, never Y** (§2).
- **Branded components and third-party logos keep their own colors** (§9).
- **Transform and opacity never share a curve or a length.** Arrive and lock.
- **One accent color, spent sparingly.** Cohesion comes from a shared backdrop, identical framing and consistent captions — never a color wash.

## 2. Text rendering & jitter

- **Root cause of all text jitter**: browsers snap glyph *baselines* to whole device pixels while x-advances keep sub-pixel precision. The identical curve that ticks on Y is smooth on X → text moves on X (`remocn/short-slide-right`) or doesn't translate.
- **Mechanism**: ONE `translateX` on the whole paragraph, stagger purely in per-word *opacity*. Per-word X travel slides words through each other in the shared line box.
- **A transform on a span forces `display: inline-block`**, which breaks two-tone inline paragraphs — one half wraps onto its own line. Transform the wrapper, keep inner spans plain.
- **When purging Y, grep `translateY` in every text-*bearing* container** (console panels, terminal wells, captions, bylines), not just type primitives. translateY is for non-text geometry only; keep the camera off type entirely.
- **Text inside a continuously-animated scale wrapper trembles** — a ~1px row snap plus a per-glyph sub-pixel wave. Fix: `willChange: "transform"` on the animated wrapper **and** `--scale=2`. `rotate(0.05deg)` fixes the row snap alone but is harmful once will-change is in place — never stack them.
- **will-change only helps content at rest.** For an unavoidable translateY entrance, **land the travel in ~60% of the frames** (opacity/blur keep the full curve) so every half-integer pixel crossing happens in the fast phase; mirror it for ease-in exits. While text translates, keep speed above ~0.5px/frame or don't translate it.
- **Refuted**: per-char splits into promoted layers — sixteen promoted text layers shimmer even at rest (0.40 jerk vs 0.00 plain).
- **Never animate layout `width` for a reveal** — width springs re-lay-out the row every frame and drag the largest type across fractional pixels. Keep wrappers at final size; choreograph with transform + clip-path and re-center with a compensating translateX.
- **A centered line being "written" reserves its full width from frame 0** (per-glyph opacity toggle), or it re-centers mid-write.
- **Measuring jitter**: ffmpeg `format=gray` → luma threshold → `tblend=difference` ×2 → `signalstats`, ranked by spike. Two tblends (`tmix` with negative weights clamps to zero); SAD trackers give garbage on fast motion.

## 3. Fonts

- **`@remotion/fonts` `loadFont()` at module scope silently does nothing** — its delayRender fires before any composition mounts, the promise dies, and the render proceeds in the fallback face with no error. Load inside the composition: `useEffect` + `delayRender`, gate the tree on a `loaded` flag, double-`requestAnimationFrame` before `continueRender` or stills race the screenshot.
- **One-frame stills happily render in the fallback font** — thumbnails must hold the render until fonts resolve (`waitUntilDone()` / `document.fonts`).
- **Judge fonts only on full-scale stills** — at `--scale=0.5` a pixel font's stepped glyphs look exactly like a Courier fallback.
- **Canvas-measure text, never assume 0.6em**; recompute after `document.fonts.ready` behind a delayRender gate or fallback metrics get memoized.
- **Canvas `textBaseline: "middle"` sits above a flex-centered DOM span** — rebuild the DOM math: alphabetic baseline at `H/2 + (fontBoundingBoxAscent − fontBoundingBoxDescent)/2`.
- **Licensed fonts load via `staticFile` only** — never republish them to a shared assets bucket.
- **Check glyph coverage of vendored faces** — a missing `→` (U+2192) falls back silently mid-line. Draw arrows and checks as SVG.
- **A brand shipping only Roman/400 is `fontWeight: 400` everywhere**; emphasis comes from size and color, or the browser synthesizes an ugly bold.
- **System-font measurers under wide display faces overlap words**: pass `measureScale` (Cal Sans 64px ≈ 1.16, Geist 600 56px ≈ 1.1) and verify full-scale. Cal Sans + `tabular-nums` renders the thousands comma at full digit width → drop the comma, keep tabular-nums.

## 4. Remotion timing model

- **`durationInFrames` is scoped to the nearest `<Sequence>`.** Self-pacing components (RollingNumber, AnimatedLineChart) see the *scene* length — keep `speed ≈ 1`. Speed 9–13 "to compress" finishes them in ~10 frames under the entry blur: apparently static.
- **`<Sequence>` rebases `useCurrentFrame()` to 0.** Components gated on ABSOLUTE scene-frame constants must not be wrapped in one, or the gates never fire and the phase renders blank.
- **`<Sequence>` renders an AbsoluteFill** — inside a card the parent must be `position: relative`, or it expands to the nearest positioned ancestor and overflow clipping silently stops.
- **`<Loop>` clips its last iteration to the parent's remainder.** Exit interpolates of the form `[exitStart, durationInFrames]` invert when the clipped duration < enter duration and crash the FULL render only — stills never hit the bad frame. Gate with `hasExit = exitStart < durationInFrames`, or run a local exit clock over `[0, exitDur]`.
- **`interpolate` inputRange must ascend** — a descending range throws only on the frames that hit it (dwell frames), invisible in spot checks.
- **`OffthreadVideo` must never be asked past its clip end** — freeze at `liveFrom + clipFrames − margin`. Self-contained excerpts start at t=0, so NO `trimBefore`. Peak simultaneous decoders ≈ 8.
- **transition-rail does not wrap scenes in a Sequence** — `useCurrentFrame()` there is the GLOBAL clock; compute slot starts yourself. Frame-exact rebuilds need absolute `<Sequence>` per scene, not TransitionRail.
- **Naive odometer math** (`pos = value/10^place % 10`) leaves higher columns resting *between* digits whenever the value isn't a multiple of their place. Use `pos = wrap10(startDigit + progress × travel)`, `travel = (fullTurns×10 + stepDelta) × dir`.

## 5. TransitionSeries & presentation traps

- **The ENTERING presentation stays mounted at `presentationProgress = 1` for the whole incoming scene.** Anything not exactly 0 at p=1 paints over the scene until the next cut — a field that only fades IN sits opaque forever; a window running to 1.08 never clears. Fix at source AND give every presentation a tail guard (`interpolate(p, [0.9, 0.99], [1, 0])`) or tail-faded fields (`[0.08, 0.32, 0.78, 0.98] → [0,1,1,0]`).
- **Never leave a composited no-op layer alive.** A full-frame mask/filter/clipPath wrapper "doing nothing" at p=1 is 3840×2160 at `--scale=2`, and on some GPU/driver combos Chrome's tiling repeats the last drawn slice — the headline ghosts 2–3× right with a seam. At p≥1 return bare `{children}`; masks return `null` when complete (also ~33% faster). Pin `--gl=angle` to kill driver variance.
- **The entering layer composites ON TOP of the exiting one** — "halves part to reveal the scene behind" silently inverts. Any reveal-from-behind seam must draw BOTH scenes itself every frame.
- **A scene that both enters and exits is wrapped in TWO presentations, the EXITING one OUTSIDE.** A context Provider from the inner presentation wins while pinned at p=1 for the scene's back half → every exit silently no-ops. Nested boundary effects must COMPOSE (multiply opacities, concatenate transforms, intersect masks), never override — the hardest bug class, since both boundaries look correct alone. When plate and content need different rules, hand-roll the sequencer (~30 lines).
- **Cover-style transitions leave a legible headline under an opaque texture for ~⅓ of the boundary.** Rewrite covers as WIPES: one front crosses the frame, incoming clear behind it, outgoing clear ahead of it, brand texture only a narrow band riding the front, both scenes masked with the same gradient geometry from opposite sides.
- **Presentations have no local frame count** — run springs on `vFrame = presentationProgress × REF_FRAMES`.

## 6. Boundary design

- **A wipe front travels linearly** (or `bezier(0.42, 0, 0.24, 1)`). The house exponential puts it 93% across by p=0.46 — it reads as a flash, or as nothing.
- **A wipe masks the CONTENT, not just the plate**, or it reads as a decorative band sliding over a dissolve. Both sides carry the same `linear-gradient` mask from complementary sides on the same eased progress.
- **The mask must NOT travel with the content.** A CSS mask resolves in its element's own box and is then mapped through that element's transform, so mask + translate on one element puts the front off the ground's line by exactly the travel distance. Two layers per scene: outer carries the mask and is never transformed, inner carries opacity/translate/scale/filter.
- **A front with nothing behind it is a curtain.** A wipe *reveals*; it doesn't move anything. For a boundary to "pull" the next scene in, the content must LAG the front — a spring that finishes early and waits reads as "arrived and stopped".
- **Masked reveals ride the crop box, not the full-size children** — masking the children exposes a band the crop already cut, and the frame goes empty mid-transition.
- **Seam occupancy**: never drive both halves off the seam's raw progress with a power curve — at the midpoint neither has visibly moved and all travel happens while invisible. Each half runs its own full curve over overlapping sub-ranges (OVERLAP ≈ 0.42), and every incoming scene puts something on screen by its own frame 0–8.
- **Scenes a boundary REVEALS (wipe/lift/push) need content at local frame 0.** Scenes a slide carries in are blind for ~12 frames → give them a pre-roll `lead` of 12–20f (`f = local + lead`) so the plate arrives mid-assembly, already moving. Scenes either side of a HARD cut must be fully composed at frame 0. Best of all is static structure the plate simply carries: a plate that lands blank and then assembles itself is two events where the boundary should give one.
- **A composed scene carried by a boundary gets a clock independent of the lead and no travel of its own** — a second translate on top makes the arrival mushy.
- **For any fade-based boundary, render p ≈ 0.3–0.35 and confirm it is not empty.** `lift` drops the outgoing at 0.3 but reveals the incoming at 0.34, so a plate with an invisible backdrop and a delayed headline reads as a cut to black. Wipes don't have this failure mode.
- **The 3-phase gap (content out → plate crossfade → content in) is only for a GROUND tone change** — a black↔white crossfade passes through mid-grey, so the plate must change while nothing is on screen. Between same-tone scenes it costs ~5 empty frames for nothing. Symptom: a blank tile in the contact sheet at a boundary midpoint.
- **The background must not travel in a slide** — translating the whole AbsoluteFill sweeps a hard flat-color edge across the frame. Split every scene into a pinned plate (color + field + grain + vignette + camera) and a travelling content layer.
- **Percentage translate on a diagonal is a trap**: `translate(x%, y%)` resolves x against width and y against height, so a "100%" push along 45° on 1920×1080 leaves the incoming plate a quarter on screen. Full clearance needs ≥141%.
- **Sub-threshold cuts read as NO transition.** Below the threshold at which the eye registers an authored event it just looks like the scene switched. A boundary that has to be explained before it can be seen is a caption, not a boundary.
- **Vary boundaries by DIRECTION, not mechanism** (settle / drop↓ / slide← / rise↑ / slide→; no two adjacent share one). **Pick the grammar by TONE, not variety**: `settle` for big tonal jumps, since its color change happens inside the empty gap frame; slide/rise only between scenes already sharing a tone, or a stage-color crossfade gives ~6 washed mid-grey frames.
- **Longer boundaries eat dwell** — only `dwell − in − out` is screen time. A 64f transition beside a 66f scene leaves ~2 clean frames. Budget LEAD/TAIL into neighboring beats, and never start a count-up before its own transition reveals the plate.
- **Match cut / seamless zoom**: both contact surfaces the SAME flat hex at the crossover; incoming content gated until the transition lands; a blinking cursor goes solid before the dive; the camera FREEZES before the dive, or it smears the match. The rect math is 2px-fragile — count 1px dividers, use border-box headers, and remember a box-shadow ring isn't a border (a border grows the box and shifts the rect).
- **A post-credits sting needs no new transition — `settle` already is one** — but it must not sit empty (~26 black frames read as "film over"). Give it an entrance unlike anything else in the cut: pure fade + a hair of scale, no travel, no stagger.
- **Mask-grow over a shared backdrop**: scenes are transparent, so a clip-path reveal needs its own surface fill, and NOTHING may opacity-fade before it is physically covered (fading on raw progress exposes bare backdrop at the frame edges). Key every fade to the mask-coverage value, computed identically in both directions, and make every last-to-leave layer backdrop-colored. If the backdrop is a live shader, pass the backdrop STACK as a prop and let covering layers re-render it — a second instance is frame-identical, so hand-offs are pixel-invisible.
- **One transition language per film; spend `fade` once**, at the final lockup — four fades out of seven cuts reads as a slideshow. Don't reset the camera at cuts: one continuous CameraRig on the absolute frame is the connective tissue (subtle; big global zoom = nausea), one shared glow/grain palette.
- **Clip-path portals are wrong for "fly through + approach"** — the incoming draws clipped inside the shape then pops when the mask clears, and the outgoing scene's own shape reads as a second copy. Fly-throughs are: outgoing self-dives at the aperture's origin until its interior swallows the frame, then the incoming approaches out of that ground (scale up + unblur).

## 7. Motion & choreography

### The three-pass rule — a sequence isn't finished until nothing in it comes to rest

Build every scene in three passes. **The first two always look done, and both are wrong.**

1. **Blocking** — the right moves in the right places. *Icon rises from below, morphs into the full tile, holds, slides off the top.* It worked and it was completely dead.
2. **Character** — the eases and the splits. *Headline splits into words at runtime, each word masked and pushed up through its own window on `back.out(1.7)`, staggered 0.045s (≈1.5f), starting 0.06s (≈2f) before the card lands.* Alive, still cheap.
3. **Overlap** — nothing is allowed to finish. This is the pass that matters.

**Pass two is cheap for exactly one reason: every element completed, and only then did the next start. Every card came to rest. Rest is what reads as cheap.** So overlap everything:

- **Growth outlives its own trigger** — the card grows 1 → 1.05 over 0.86s (≈26f), ignited by the morph, so it is still growing when it starts to leave.
- **Anticipate the launch, don't trigger it** — crouch `scaleY` to 0.93, stretch to 1.05, then fire.
- **Swap on ONE axis with mirrored eases** — the outgoing accelerates off the top on `power4.in` while the incoming whips in from below on `power4.out`: same axis, same direction, opposite curves, never in the same place at once.
- **Data bleeds into the exit** — counters still counting and bars still growing when the crouch starts. Nothing waits its turn.

**The test, on every scene: name a frame where everything on screen is at zero speed.** If you can find one, it is a pass-two scene and it is not finished. This governs the rest of §7 — the standards below are its instances, not exceptions.

### Standards

- **The settle standard** ("the standard for all videos"): exit = the whole scene shrinks to ×0.84 over 6f on pow5 ease-in, AS ONE GROUP — per-element scaling drifts multi-line text apart, because line boxes keep height while glyphs shrink. ~1 empty gap frame; bg crossfades ~4f centered in it (content never crossfades, only bg). Enter = items from ×1.24, spring d30/k320/m1, opacity in ~5f, staggered ~3f; a multi-line text block is ONE item. No Ken-Burns dwell drift.
- **The slide standard**: strictly sequential, never overlapping (concurrent A/B ghosts). A is shoved 10% of the axis, pow5, 22f, hidden by an accelerating t² fade inside its own tail; B springs in from 28% on d60/k300/m0.5, overshoot-clamped, fade-in 24f decelerating; one shared canvas color throughout.
- **An exit is never an entrance reversed** — the asymmetry is curve and length, not direction. A TRAVELLING shot leaves on its own vector, shorter than the entrance and accelerating where the entrance settled.
- **An arc has a source; a fade does not.** Five fade-and-scales in a row are five identical nothings. Build tosses from ONE flight parameter (x eased-out, vertical hump `4t(1−t)` of the same parameter); rotation gets its own springier curve so the spin settles AFTER the position lands. Two separately-timed animations that "look like an arc" drift apart on the first retune.
- **Ambient cycles need mutually prime periods** — 8/10.5/13, or 29/31/37/41/43. Harmonic sets re-sync within two cycles and read as a metronome.
- **`floor((local − offset)/period)` starts at −1 for offset rows** — the cycle opens on its LAST item then jumps. Anchor the index to the first event.
- **Stagger direction carries meaning**: growing gaps (power ~1.3) for failures and exits, compressing gaps for arrivals.
- **Depth swaps** ("one socket, changing occupant") beat lateral ejects, which read as two different places. Blur must be TIED to scale — softening without shrinking reads as a focus defect; cap blur ~11px. Never park a visible low-opacity stack behind at rest: a dim logo behind a logo is a smudge, not a deck.
- **Animate the mark's OWN parts — never a substitute, never spawned copies.** The firing state and the finished mark are the same objects at different values of one parameter, so there is nothing to hand over. Feed all layers identical geometry or the hand-off seams.
- **Hand pixels over with a mask, never a crossfade**, when one layer must *become* another (radial-gradient `maskImage`, radius = flood progress) — fading greys the parts the flood hasn't reached. **Remove a superseded layer only when its replacement fully covers it**, or two shapes are on screen.
- **Still geometry ≠ a still frame.** When a held beat feels dead, send something ALONG the geometry before agreeing to move the geometry. SVG recipe: `pathLength={1}` normalizes dash math across paths of different lengths; dash gap > path length guarantees exactly one bar; `strokeDashoffset = SEG − t·(1 + SEG)`; fade both ends of the run; guard the arrival tick with `since < period ? 0 : …` or every card ticks at frame 0.
- **Make a consequence, not a second animation.** A mark's leftward travel is flexbox re-centering as the wordmark's `maxWidth` opens from 0, not a matched translate. A panel's squeeze is its edge as the running sum of the neighbors' animated widths.
- **Structure before content**: a hairline draws, then content arrives into the box it made — a free reveal in the back half of the beat.
- **Camera continuity is C1**: dwell drift eases in-out so velocity is zero at every dwell↔hop joint, or the take judders. `filter` FLATTENS `preserve-3d`, so motion blur lives on an ancestor of the perspective element. Cull fly-past objects early (relZ ≈ −140): projected scale is hyperbolic in depth, and anything visible past that explodes several × per frame and reads as camera shake.
- **One-take grammar**: no transitions — still camera on a tile while it plays (zoom exactly 1 = pixel-crisp), sin-eased pull-back glide between tiles, scenes start `LEAD ≈ 34` frames before the camera lands so the next tile is already waking mid-glide, finished scenes freeze on their last frame. Blur from SCREEN-space speed (world speed × zoom).
- **Zoom rigs**: additive springs in the log-scale domain keep overlapping beats continuous; dive targets need a small overshoot past the exact fit (2.0 → 2.1) or the last percent leaves a border seam; anticipation is a tiny opposite-direction segment ~8f before the dive; screen-space chrome divides by the projected scale so 1px stays 1px; SVG contours under scaling need `vectorEffect="non-scaling-stroke"`, else stroke-width is in viewBox units.
- **Stop-motion (quantized clock)**: per-pose displacement ~a hand-width, spring settle ≥ ~20 poses for desk-scale travel or it reads as glitching; stagger mass arrivals into waves of 1–2 items and delay the camera move until the first wave is airborne.
- **Path morphs**: `interpolatePath` figure-eights on winding/start-phase mismatch and `reversePath` alone doesn't fix it. Resample both closed glyphs to fixed-N rings, normalize winding by shoelace sign, rotate the target ring to the min-squared-distance phase, lerp points. Order morph chains by silhouette similarity; every post-morph action starts AND ends at identity.

## 8. Scene & story structure

- **Empty frames at frame 0 are the most expensive mistake a 30s cut can make.** The FIRST scene's clock starts at ~0 regardless of any boundary lead, so its first element takes a negative `at`.
- **Land the last frame — the outro has NO exit.** The final frame is one someone screenshots; flying the mark off reads as a glitch. Drop the URL when there is nothing left to say.
- **One close carrying five things is five things read past.** Split it; the strongest number in the pitch deserves its own scene, not a subtitle.
- **A viewer reads a repeated diagram as repetition, not a rhyme** — however carefully the second shot inverts the first. If a shot pays off twice it spends its surprise the first time; cut the setup beat.
- **A shot containing only type cannot hold ~50 still frames** — past ~20 the viewer stops reading and starts waiting. Long holds need a second element in frame.
- **Never show a heading and its visualization in the same scene** — the heading gets its own breaker.
- **Labels on a filling bar ACCUMULATE, never replace** — swapping them orphans every filled block and reads as the frame losing information.
- **Tight dwells after a progress bar completes**: ~16–20 frames, then move. Idle beats grow back silently; watch for the ~2s hang.
- **Don't open with text** — the opener is the marks assembling, motion first.
- **Rebuild the product's OWN signature components and animations, never abstract metaphors.** Two cuts were deleted as "nothing to look at"; the fix was porting the product site's actual demos with their actual labels. Metaphor scenes are the first thing a client kills.
- **Don't demonstrate features that don't exist.**
- **A build is one clock** — don't split a logo build across a match cut; it is one continuous object.
- **Confirm the axis before building** — "друг под другом" meant stacked along Z (overlapping), not a vertical column.
- **Best-on-paper ideas fail on screen.** WATCH the render (or contact-sheet it) before defending an idea — reasoning about a boundary is not seeing it.
- **The changelog-series formula**: each release debuts exactly ONE new transition that *performs the release's meaning*, used exactly twice; the outro is inherited verbatim from the flagship film.
- **Galleries**: camera scrolls over grids and carousels are rejected (blank frames, unwanted movement). Fixed center card, items stacked on Z, each blooming over the previous via a center-out clip-path (`inset((1−p)·50% round 16px)`).

## 9. Brand fidelity & research

- **Branded components keep their OWN colors** — never wash a vendor mark into the video's palette, never override its `accentColor`. Being recognizable as that product is the entire point; a wash shows the video's art direction instead of the release. The only justified intervention is *legibility*: a light-hardcoded component on a dark canvas gets `invert(1) hue-rotate(180deg)` (flips luminance, restores hue). Use CSS `filter`, never `mix-blend-mode`, which paints solid over transparent component roots. Their THEMES are shared module constants — never mutate them.
- **Read the brand off the LIVE compiled stylesheet** (palette, type scale, radii, tracking, weights), and expect source comments to lie — a "matches #141318" comment sat over a token computing to #09090b, and the 1-token gap was load-bearing.
- **Decode assets — never trust filenames or fetch summaries.** "purple-icon.png" contained no purple pixel, and the fetch summary confidently called it a purple brand.
- **Real logos verbatim**: inline the site's actual SVG paths; if only a raster exists, trace it (threshold → connected components → Moore boundary → Douglas-Peucker). Never redraw by eye, and don't "fix" authentic quirks — a slanted parallelogram `I` is the brand, not a bug. Omit raster-only marks rather than embedding mush.
- **Mine the brand's own geometry for the motion language** — a quantized dot lattice animates and can *become* a diagram; a logo of separate solids on an exact 60° means assembly IS the story. Assets drawn for 56px chrome don't scale to hero beats; re-author at beat scale.
- **Spend the accent the way the site does** (often: almost never). Don't import a second typeface when the identity has one, and don't invent a palette for a monochrome brand.
- **Lockups: match SYMBOL heights, not letter heights** (measured: caps = 0.605 × symbol height). Guidelines forbid reconfiguring logo proportions.
- **Positioning moves** — re-verify live homepage copy and CLI commands at build time; never reuse an old script. Two products can share a name: verify which one the film is about before writing a line.
- **Docs go stale**: SCRIPT.md/STORYBOARD.md frame numbers drift after edits. The `*_DURATION` constant in `index.tsx` is the only source of truth.

## 10. shadcn/ui, HTML UI & CSS-in-video traps

- **shadcn `transition-*` utilities run on WALL CLOCK, not the frame clock.** A hard theme/var flip starts a real-time CSS transition and the frame screenshot catches it mid-flight — adjacent frames disagree. Fix: `.video-scope * { transition: none !important; animation: none !important; }`. Verify with pixel samples from CONSECUTIVE frames (`--sequence` + ffmpeg 1×1 crop); stills cannot reproduce it, because a direct seek mounts the class already applied.
- **react-day-picker's "today" follows the render-day wall clock** → nondeterministic across days. Always pass `today={...}` alongside `selected`/`month`.
- **Portal primitives (open tooltip/dropdown/dialog) escape camera transforms** — under transformed planes use inline-rendering components only (Command, Calendar, Accordion).
- **Regular-weight rule over components shipping font-medium/semibold**: `**:font-normal!` on the wrapper.
- **Dark-first `global.css` leaves `:root` without `--background`/`--foreground`** → a light-theme render paints transparent where background is expected. Both var sets must exist in `:root`.
- **CSS-var pins do NOT stop inherited computed styles** — a `--font-sans: var(--font-sans)` self-reference broke the html font and serif leaked INTO the pinned subtree. Declare `font-family` on the scope element itself. Pinning identical values can't prove scope-correctness; only a diverging theme exposes holes.
- **`text-indent` INHERITS, and an inline-block is a block container** — a heading's first-line indent re-applies in front of every animated word span (~80px gaps); word spans need `textIndent: 0`. Word gaps are `marginRight`, not a space character: a trailing space in a `white-space: pre` inline-block doesn't collapse.
- **Registry typography components render `position: absolute; inset: 0` centered and read `var(--font-geist-sans)`** — set the var on the composition root, and give each line its OWN positioned box (they can't stack in normal flow). Per-char effects need `speed ≈ 2.2` to finish a long line inside a scene.
- **Primitives that hardcode the light theme** go on a small light Stage card when the film is dark — don't recolor them.
- **GlassCodeBlock's tokenizer mangles number literals** (`60_000` → `,`, `-0.025em` → `-0.;`). Keep samples to clean literals and verify every code window on a rendered still, not a typecheck.
- **RollingNumber's root is an AbsoluteFill** — in a flex child it anchors to the nearest positioned ancestor and centers over the whole scene. Wrap it in a `position: relative` box with explicit size (~`0.62em × digits` × `fontSize × 1.1`) + `overflow: hidden`.
- **Translucent cards over live content are unreadable** — flatten to solid, `overflow: hidden` on the container, pin content with flex-end.
- **~1000 absolutely-positioned per-glyph spans lag Studio** — canvas/SVG for swarms.
- **Terminal scroll is a smooth ~10-frame eased glide, not a snap**; overlapping glide windows compose additively. A CTA caret renders only once the command starts typing — no caret idling on a bare `$`.

## 11. Shaders, WebGL & three.js

- **Everything WebGL renders black or throws in headless Chrome without `--gl=angle`.** `Config.setChromiumOpenGlRenderer("angle")` covers the CLI and Studio ONLY — Node-API scripts must pass `chromiumOptions: {gl: "angle"}` themselves. `remotion.config.ts` is in tsconfig's `exclude`, so typecheck it explicitly. A looped shell command can exit 0 while the still silently fails — check the output file landed.
- **ShaderLiquidMetal renders a rounded card, not fullscreen** (even with `shape="none"`); god-rays/warp/mesh-gradient/voronoi/metaballs fill edge-to-edge.
- **Dither dissolves need `shape="simplex"`** — the default `wave` fills half the frame with solid colorFront.
- **Grayscale ripple tunnels are nearly invisible at color-preset values** — hold `scale` low (0.22 → 0.55 through the readable window), `intensity ≈ 0.8`. The entering child is hidden until p ≈ 0.86, so any draw-on inside the incoming scene must START at that reveal or it is spent behind the cover.
- **Voronoi as a statement cover**: mid-brightness cells read as loud stained glass. Near-black tinted cells, gap ≈ 0.07, `colorGlow` = the background hex, animate `scale` for the bloom, tail-fade the field.
- **Caustics: the filaments are the ZERO-CROSSING set** — light them with `exp(-abs(c))` (sharp core + soft halo), not `pow(clamp(c,0,1), k)`, which is a flat grey gradient with no veins.
- **three.js inside Remotion**: pass `flat` on ThreeCanvas or ACES tone mapping lands a calibrated light rig ~40% dark; fix SVG y-down with rotation `[π, 0, 0]`, never `scale(s, −s, s)` (mirrors windings/normals); mount ThreeCanvas for the WHOLE scene, since a conditional mid-scene mount flashes black on context creation; drive the camera by mutating it in render from `useCurrentFrame` (`useFrame` flickers); `backgroundColor: "transparent"` composites over DOM shader fields; TubeGeometry + `setDrawRange` walks a stroke like an SVG dashoffset.
- **Glossy sheen over near-white glyphs**: pure white is invisible on #f2f2f2 — the band needs dark shoulders (shadow–highlight–shadow). Sheen is white, never the accent color.
- **No rigid-body physics package exists for Remotion** — deterministic physics = `@remotion/noise` + analytic kinematics.

## 12. CSS & layout traps

- **A CSS value containing newlines is dropped whole by the CSSOM** — a multi-line template-literal gradient renders as *nothing*. One line; clamp stops to [0,100] and keep them monotonic, since violations also void the declaration.
- **`linear-gradient(Adeg)` aims the AXIS; the bands run perpendicular** — a 60° front takes `60deg`, not `90 − 60`.
- **Decorative marks along a wipe front: scatter in screen space, then project onto the gradient axis with CSS's own formula** (`|W·sinθ| + |H·cosθ|`, centered on the box). Placing marks in (along, across) coordinates and inverting puts the band on a different line than the mask.
- **A `gap` on a flex row whose last child is zero-wide still occupies layout** — the row centers offset by gap/2. Put the gap INSIDE the clipped box as `paddingLeft`.
- **`clipPath` doesn't shrink the box** — a lockup mid-reveal sits centered on its FINAL width with a hole beside the mark; translate the group by half the still-hidden width. (`maxWidth` genuinely shrinks and re-centers for free, but never animate width where text jitter matters.)

## 13. Rendering & verification

- **Ship render**: `npx remotion render src/remotion/index.ts <id> out/<id>.mp4 --scale=2 --crf=15 --x264-preset=slower --jpeg-quality=95 --gl=angle`. `--scale=2` is not optional — fine-stemmed type breaks up at 1× under H.264, and a 1px accent rule disappears into subsampled chroma (accent rules ≥3px).
- **Background renders lie twice**: completion notifications fire EARLY, so monitor the output file rather than the task; and killing the task kills only the shell wrapper — the render SURVIVES and keeps writing, so a replacement render to the same path interleaves two writers and corrupts the mp4. `pkill -f "remotion render"`, then re-check `pgrep`.
- **`ffmpeg -ss` before `-i` seeks to keyframes** — for exact frames use `--frames=a-b --sequence`.
- **Contact sheet**: `ffmpeg -i video.mp4 -vf "select=not(mod(n\,24)),scale=320:-1,tile=6x7" -frames:v 1 sheet.png` catches empty boundaries, blank openings and dead frames. The tile grid PADS MISSING TILES WITH BLACK — trailing black tiles are not a fade-to-black.
- **Probe-color verification beats inference**: to learn each scene's true span, swap every scene for a solid probe color, render `--scale=0.1 --sequence`, read the pixels. Inference from frame counts was wrong three times.
- **Verify on pixels, not on types** — code windows, fonts, seam midpoints (p ≈ 0.3), transition frames, count-up values across frames. Renders are deterministic with `--gl=angle`, so byte-comparing stills against a baseline is a valid regression check.
- **A pipe masks an exit code**: `tsc | tail -20` reports the pipe's status. Diff error COUNTS against a stashed baseline instead.
- **YouTube covers**: hard 2MB cap (ship gradient art as JPEG ~92). Before re-rendering a cover that "looks blurry on YouTube", open `https://i.ytimg.com/vi/<VIDEO_ID>/maxresdefault.jpg` — if that is sharp, the grid is serving a small derivative upscaled on hi-DPI and no re-render changes which one is picked. Large smooth near-black gradients do block up under YouTube compression; flat grounds stay clean.

## 14. Project & dependency traps

- **A standalone demo inside a parent repo must do three things**: `index.tsx` re-exports the composition component directly, past the standalone `registerRoot` entry; the nested `node_modules` is DELETED, because a second copy of `remotion` gives every hook its own React context and `useCurrentFrame` sits at 0 forever — a **still film with no error**; and no `staticFile`, which resolves against whichever project's `public/` is serving (inline as base64 data URIs).
- **Pin `remotion` and every `@remotion/*` to the same EXACT version** — caret ranges get bumped by `shadcn add` installs → "Multiple versions of Remotion" build failure.
- **Node render APIs ignore `remotion.config.ts` entirely** (alias, tailwind, gl) — every render script re-declares them. Bundle ONCE for batch stills; `remotion still` re-bundles the whole project per call.
- **Assets served cross-origin need CORS** (`python3 -m http.server` sends none). Only `REMOTION_`-prefixed env vars reach compositions, and the Node bundler API reads NO `.env`, so env-based asset overrides never reach script-driven renders.
- **Check for squatters before building** — untracked stock templates with their own `package.json`/`node_modules` at the target path, including case-variant folders on macOS's case-insensitive FS.
