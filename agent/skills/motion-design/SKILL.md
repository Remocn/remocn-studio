---
name: motion-design
description: >
  How a video frame should look and move — scale, layers, color presence, framing and
  motion choreography, written for Remotion's interpolate/spring. Read BEFORE designing
  any scene or composition, and again when a result comes out generic: web-sized text,
  an empty centered layout, decoration nobody can see, motion that reads as static.
  These are design rules, not incident fixes — production failures live in video-lessons.
---

# Motion design

**A video frame is not a web page.** Every generic result traces back to web habits:
web type sizes, web opacity, web centering, web restraint. This skill is the set of
video habits to replace them with.

Numbers here are starting values, calibrated for 30fps at 1920×1080. Scale durations
with fps and sizes with resolution. Where `remocn-studio:video-lessons` disagrees with
anything here, **video-lessons wins** — its rules are measured on this studio's own
renders, these are design defaults.

---

## 1. Scale: everything is bigger than you think

Web sizes are invisible on video. The viewer sits farther away, the encoder eats fine
detail, and nothing can be hovered or zoomed.

| Element            | Web habit | Video    |
| ------------------ | --------- | -------- |
| Headlines          | 32–48px   | 64–120px |
| Body text          | 14–16px   | 28–42px  |
| Labels, metadata   | 12px      | 18–24px  |
| Decorative opacity | 3–8%      | 12–25%   |
| Borders            | 1px       | 2–4px    |
| Container padding  | 16–32px   | 60–140px |

Two hard checks before writing a value:

- **A font size under 24px needs a written justification.** Fine print exists on video —
  a registration mark, a monospace coordinate readout — but it is a deliberate garnish,
  never the message.
- **Decorative opacity under 10% is invisible.** A 6% glow that reads on your monitor
  disappears under H.264. Start at 12% and confirm on a real render (a Snapshot still),
  not in the browser.

A web UI card — `border: 1px solid`, a 4px shadow at 6% black — is invisible at video
distance. Bolder borders, stronger fills, real shadows.

## 2. Layers: three roles, six to ten elements

A frame with three elements looks broken, like a page that failed to load. A produced
frame carries six to ten visual elements in three roles:

- **Background** — never a flat solid. A radial glow, oversized ghost type bleeding off
  the frame, a color panel, grain, a grid. This layer is what keeps the frame alive
  while foreground content is still staggering in.
- **Midground** — the message itself: the headline, the card, the stat, the code block.
- **Foreground accents** — hairline rules, dividers, small labels, data bars, monospace
  metadata. The details that make a frame feel produced rather than generated.

Two of those elements should be decoration nobody asked for. Add them anyway: empty
frames read as bugs.

**The decoration recipe:** 2–5 decorative elements per scene, all riding one shared,
slow ambient motion — a breath, a drift. One motion across several elements is the
point; five decoratives each doing their own thing is noise, and one lone decorative is
an under-dressed frame. Static decoration is worse than none — at 30fps it reads as a
rendering mistake.

```tsx
// One slow drift shared by the ghost type and the glow — hardcoded, seek-safe
<Interactive.Div
  name="Ghost word"
  style={{
    position: 'absolute',
    left: -80,
    bottom: -40,
    fontSize: 420,
    fontWeight: 900,
    opacity: 0.14,
    translate: interpolate(frame, [0, 240], ['0px 0px', '48px 0px'], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
>
  LAUNCH
</Interactive.Div>
```

## 3. Color: muted is fine, flat is not

Every scene needs at least one color that pulls the eye.

- **The accent must be visible.** 15–25% opacity for atmospheric washes, full
  saturation for focal hits. A 5% glow is not brand presence, it is a no-op.
- **Light canvases are not dark canvases with the values flipped.** On dark, an accent
  glow pops by itself. On light, glows die: reach for bolder solid borders (2px+),
  strong structural rules and dividers, and full-saturation accent hits instead — and
  give the background texture (grain, a faint pattern), or it reads as a blank slide.
  If the palette is light, make light cinematic; never silently switch to dark.
- **No full-screen linear gradients on a dark background.** They band visibly under
  H.264. Use a radial gradient, a solid, or a solid plus a localized glow.
- **Tint neutrals toward the accent hue.** Dead gray reads as undesigned. A warm or
  cool cast on every neutral is what makes a palette feel intentional.

## 4. Framing: anchor, split, travel

Centered-and-floating is a web layout. Video frames are composed:

- **Two focal points minimum.** The eye needs somewhere to travel. A single text block
  in empty space is a slide, not a frame.
- **Fill the frame.** Hero text spans 60–80% of the frame width.
- **Anchor to edges.** Pin content to left/top or right/bottom. The empty diagonal is
  where the decoration and the second focal point live.
- **Split layouts.** A data panel left and content right; a metadata bar on top and
  full-width content below. Zones, not centered stacks.
- **Structural elements earn their place twice.** Rules, dividers and border panels
  create paths for the eye — and they animate well:

```tsx
<Interactive.Div
  name="Section rule"
  style={{
    height: 3,
    width: 640,
    backgroundColor: '#e8602c',
    transformOrigin: 'left center',
    scale: interpolate(frame, [8, 26], ['0 1', '1 1'], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
/>
```

## 5. Concept before markup

Declare the design before writing a line of JSX:

1. **Interpret the prompt into real content.** A recipe scene lists real ingredients; a
   dashboard shows real readouts. Placeholder content produces placeholder design.
2. **Declare the palette** — one background, one foreground, one accent — and whether
   the canvas is light or dark. Food, wellness, kids lean light; tech, cinema, finance
   lean dark. One accent hue for the whole film; the background stays the same across
   scenes. Never invent colors per element.
3. **Declare the typefaces.** Headlines at weight 700–900, body at 300–400 — the
   contrast between the two is the typography. Pair a serif with a sans rather than two
   sans faces. If the brand ships only one weight, emphasis comes from size and color.

## 6. Motion: subtle reads as static

At 30fps, restraint disappears. Err toward more movement than feels safe — every
decorative element carries ambient motion, every entrance is choreographed.

### Direction is grammar

- **Entering elements decelerate** — fast start, soft landing. `Easing.out(...)` or a
  clamped spring. This is the default.
- **Exiting elements accelerate** — slow start, thrown off frame. `Easing.in(...)`.
- **Elements moving between positions** ease both ends: `Easing.inOut(...)`.

Getting this backwards is the commonest motion bug: an ease-in entrance feels sluggish,
an ease-out exit feels reluctant.

### Speed is weight

| Feel                              | Duration @30fps | Seconds   |
| --------------------------------- | --------------- | --------- |
| Energy, urgency, confidence       | 5–9 frames      | 0.15–0.3s |
| Professional default              | 9–15 frames     | 0.3–0.5s  |
| Gravity, luxury, contemplation    | 15–24 frames    | 0.5–0.8s  |
| Cinematic, atmospheric            | 24–60 frames    | 0.8–2.0s  |

The slowest motion in a film should be about three times slower than the fastest. A
composition where everything takes 12 frames has no dynamics.

### Every scene: build, breathe, resolve

- **Build (first ~30%)** — elements enter, staggered by importance. Never everything at
  once.
- **Breathe (middle ~40%)** — content holds, kept alive by the one shared ambient
  motion on the decoratives.
- **Resolve (last ~30%)** — a deliberate exit or a decisive hold.

The commonest failure is dumping everything into the build and leaving a dead frame for
two thirds of the scene.

### Choreography rules

- **The first mover reads as the most important.** Stagger in order of meaning, not DOM
  order.
- **Overlap entrances** — element two starts while element one is still landing. The
  whole stagger sequence fits in ~15 frames regardless of how many items enter.
- **Exits are faster than entrances.** What takes 12 frames to arrive leaves in 7.
- **Never start at frame 0.** Offset the first animation by 3–9 frames; a zero-frame
  start reads as a jump cut from the previous scene.
- **Vary or die.** At least 3 different easings per scene, at least 3 entrance
  directions (from left, from right, from scale, opacity-only). If every element enters
  the same way, the scene has no choreography — and per video-lessons, text travels on
  X only, never Y.
- **Vary the ambient motion per scene** — drift here, breathe there, stillness after
  motion is itself a move. The same ambient zoom on every scene is wallpaper.

### The vocabulary, in Remotion terms

| Intent                       | Recipe                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| Standard entrance            | `Easing.out(Easing.quad)` / `Easing.out(Easing.cubic)`              |
| Punchy title landing         | `Easing.out(Easing.quart)` or a stiff clamped spring                |
| Dramatic, premium reveal     | `Easing.out(Easing.exp)`                                            |
| Calm ambient drift, breathe  | `Easing.inOut(Easing.sin)` over the whole scene                     |
| Physical element transforms  | `spring()` with `overshootClamping: true` (the house default)       |
| One deliberate playful pop   | `spring()` with visible overshoot — at most once per film           |
| Mechanical motion, typing    | linear, or stepped via a frame threshold                            |

An entrance combines transforms — but **opacity and transform never share a curve or a
length** (video-lessons): give each its own range.

```tsx
<Interactive.Div
  name="Headline"
  style={{
    fontSize: 96,
    fontWeight: 800,
    opacity: interpolate(frame, [6, 16], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    translate: interpolate(frame, [6, 22], ['-64px 0px', '0px 0px'], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }}
>
  Ship the film
</Interactive.Div>
```

## 7. Images are never flat

A raw rectangular image dropped into a frame reads as a placeholder. Every image gets a
motion treatment:

- **Slow push (Ken Burns)** — scale 1 → 1.04 over the beat. The cheapest way to make a
  photo cinematic.
- **Perspective tilt** — a slight `rotate` with `perspective` on the parent, plus a real
  shadow, turns a screenshot into an object.
- **Device or panel frame** — wrap it in a rounded, shadowed shell.
- **Clipped scroll reveal** — a fixed window the image travels through: the mask stays
  still, the content moves.

## 8. Transitions carry meaning

- **Crossfade** says "this continues".
- **Hard cut** says "wake up" — disruption, a register shift.
- **Slow dissolve** says "drift with me".

Crossfading everything is the tell of an unchoreographed film. Spend hard cuts on the
moments that turn.

## 9. The brand spec is brand, not layout

A design spec says what the brand **looks like** — it does not say how to compose a
video frame.

- **Strict from the spec:** hex values (background included), font families, weight
  relationships, the do's and don'ts. A light canvas the person chose stays light.
- **Yours to adapt for video:** type sizes, spacing, decorative opacity, border
  weights, component treatments. Brand colors at web-UI intensity are invisible on
  video; the color is sacred, the application is yours.

## 10. Anti-patterns: the AI tells

Each of these is the first thing a model reaches for. Using one is only acceptable as a
deliberate, argued choice for this specific content — never as a default:

- Gradient text (`background-clip: text`).
- A left-edge accent stripe on a card or callout.
- Cyan-on-dark, purple-to-blue gradients, neon accents.
- Pure `#000` or `#fff` — tint toward the accent hue instead.
- A grid of identical same-size cards.
- Everything centered with equal weight — lead the eye somewhere.
- The same ease on every animation, the same entrance on every element, the same
  stagger in every scene.
- Static decoration, or no decoration at all.
- For audio-driven scenes: equalizer bars, spectrum analyzers, waveforms, strobing.
  Audio supplies timing and intensity; the visual vocabulary still comes from the brand.
