## Evidence and decision

The landing exports 570 frames with a solid warm backdrop, three text reveals and a member card. The bundled template still exports 300 frames and imports Confetti and ShaderNeuroNoise. The URL carries only a template identifier and user props, so updating the landing cannot update the installed app.

Keep the existing bundled-copy architecture. Copy the composition and five referenced remocn components verbatim, rewriting only landing aliases to relative imports. Preserve the template entry module, schema and props slot. The scaffold continues to pin Google Fonts to the project's Remotion version; it no longer adds the unused shader package.

The sidecar owns expansion; project files remain user-owned after creation. No new state, IPC/protocol bump, database migration or settings key. Existing expansion failures remain worded scaffold errors. An old installed bundle continues to create the old template until replaced; existing projects remain unchanged.

## Verification

Run scaffold and deep-link tests, typecheck, lint and the full suite. Expand a fresh project, compile/render its copied composition and compare key frames with the landing. Build a local unsigned app and verify the packaged template matches the source.

## Font measurement correction

A render from the freshly expanded standalone project exposed crowded words in KineticCenterBuild. The landing had already loaded Manrope through Next; the standalone template had not. Calling document.fonts.load before Remotion registered the font faces returned fallback measurements. Both source copies now pass the Google Fonts waitUntilDone promise to the kinetic text component, which waits for it before measuring words. A repeated frame-90 render confirms the expected spacing.
