import { Data, Effect } from "effect";
import type { BundledLanguage } from "shiki";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeHighlighterPlugin, ThemeInput } from "streamdown";
import { errorMessage } from "@/lib/error-message";

export class HighlighterError extends Data.TaggedError("HighlighterError")<{
  message: string;
}> {}

const THEMES: [ThemeInput, ThemeInput] = ["github-light", "github-dark"];

export const loadCodeHighlighter: Effect.Effect<
  CodeHighlighterPlugin,
  HighlighterError
> = Effect.tryPromise({
  catch: (cause) => new HighlighterError({ message: errorMessage(cause) }),
  try: () =>
    createHighlighterCore({
      engine: createJavaScriptRegexEngine({ forgiving: true }),
      langs: [
        import("@shikijs/langs/bash"),
        import("@shikijs/langs/css"),
        import("@shikijs/langs/javascript"),
        import("@shikijs/langs/json"),
        import("@shikijs/langs/jsx"),
        import("@shikijs/langs/tsx"),
        import("@shikijs/langs/typescript"),
      ],
      themes: [
        import("@shikijs/themes/github-light"),
        import("@shikijs/themes/github-dark"),
      ],
    }),
}).pipe(Effect.map(pluginOf));

function pluginOf(core: HighlighterCore): CodeHighlighterPlugin {
  const loaded = new Set(core.getLoadedLanguages());
  const supports = (language: string) => loaded.has(language);

  return {
    getSupportedLanguages: () => [...loaded] as BundledLanguage[],
    getThemes: () => THEMES,
    highlight: ({ code, language, themes }) =>
      supports(language)
        ? core.codeToTokens(code, {
            lang: language,
            themes: { dark: themes[1], light: themes[0] },
          })
        : null,
    name: "shiki",
    supportsLanguage: supports,
    type: "code-highlighter",
  };
}
