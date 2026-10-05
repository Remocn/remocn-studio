# Handoff SVG assets

- `welcome-ribbon.svg`: SVG exported from the approved Paper welcome illustration. Preserve geometry; it is decorative and should be `aria-hidden` with no pointer events.
- `youtube.svg`, `youtubeshorts.svg`, `tiktok.svg`, `instagram.svg`: original Simple Icons SVG paths used by the ratio picker. Source: https://github.com/simple-icons/simple-icons/tree/develop/icons.

Render social glyphs with currentColor from the semantic foreground token. Do not stretch or redraw the paths. Badges are 32 px; glyphs 18 px, except YouTube 22 px for optical balance. Vertical-card badge offsets are 0, 26, 52 px, giving a 6 px overlap. Use platform names in the card's accessible description; do not restore visible captions.

These files are reference assets for implementation and are not imported into the current app. Interface controls use Hugeicons Stroke Rounded from the Paper icon library; brand logos use these separate brand SVGs.
