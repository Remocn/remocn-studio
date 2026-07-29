import { GRAB_PATH } from "./grab";

const CONTAINER = "__remotion-studio-container";

export interface PageOptions {
  hasGrab: boolean;
  preferred: string | null;
  publicPath: string;
  root: string;
  staticBase: string;
  title: string;
}

export function previewPage(options: PageOptions): string {
  const globals = {
    __REACT_GRAB_DISABLED__: true,
    remocn_preferred: options.preferred,
    remocn_root: options.root,
    remotion_audioEnabled: true,
    remotion_audioLatencyHint: "playback",
    remotion_envVariables: "{}",
    remotion_isStudio: false,
    remotion_logLevel: "info",
    remotion_numberOfAudioTags: 0,
    remotion_previewSampleRate: 48_000,
    remotion_publicPath: options.publicPath,
    remotion_sampleRate: 48_000,
    remotion_staticBase: options.staticBase,
    remotion_videoEnabled: true,
  };

  const assigned = Object.entries(globals)
    .map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`)
    .join("\n      ");

  const grab = options.hasGrab
    ? `\n    <script src="${GRAB_PATH}"></script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; }
      #${CONTAINER} { height: 100%; width: 100%; }
    </style>
  </head>
  <body>
    <script>
      ${assigned}
    </script>${grab}
    <div id="${CONTAINER}"></div>
    <script src="${options.publicPath}bundle.js"></script>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
