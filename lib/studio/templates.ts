export interface PromptTemplate {
  description: string;
  id: string;
  prompt: string;
  title: string;
}

const PLACEHOLDER = /\[[^\]\n]+\]/;

export function firstPlaceholder(
  text: string
): { end: number; start: number } | null {
  const match = PLACEHOLDER.exec(text);
  if (match === null) {
    return null;
  }
  return { end: match.index + match[0].length, start: match.index };
}

export const PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  {
    description: "Walk through the features, one scene each",
    id: "product-demo",
    prompt:
      "Create a 30-second product demo for [product name]. Open with the product name and the tagline [tagline] (3s). Then one scene per feature — [feature one], [feature two], [feature three] — around 7 seconds each: a short headline, one supporting sentence, and a simple animated visual for each. Close with the call to action [call to action] (4s). Use smooth transitions between scenes and keep the tone confident and energetic.",
    title: "Product demo",
  },
  {
    description: "One bold phrase over a striking background",
    id: "launch-teaser",
    prompt:
      "Create a 10-second launch teaser. One phrase carries the whole video: [main phrase]. Set it in large type over a striking animated background — a shader, gradient, or particle field — and let the words appear in beats, a word or two at a time, with a final beat revealing [product name] and the date [launch date]. Dark, cinematic, mysterious.",
    title: "Launch teaser",
  },
  {
    description: "Numbered steps with captions",
    id: "tutorial",
    prompt:
      "Create a 40-second tutorial that shows how to [task]. Open with a title scene (3s), then one scene per step — [step one], [step two], [step three] — each with a step number, a short caption, and a simple visual illustrating it (8–10s each). End with a recap scene listing all the steps. Calm and clear, with a light background and readable type.",
    title: "Tutorial",
  },
  {
    description: "What’s new, one change per scene",
    id: "changelog",
    prompt:
      "Create a 25-second changelog video titled “What’s new in [product name]”. Open with the title and the version [version] (3s), then one scene per change — [change one], [change two], [change three] — each with a short headline and one sentence on why it matters (5–6s each). Close with “Update now” and [link or handle]. Crisp, modern, and upbeat.",
    title: "Changelog",
  },
  {
    description: "A 3–5 second animated reveal",
    id: "logo-intro",
    prompt:
      "Create a 4-second logo intro for [brand name]. Animate the name in with an elegant reveal — letters fading or sliding into place — then hold it centered over a subtle background motion, and finish with the tagline [tagline] appearing underneath in smaller type. Minimal and premium: lots of empty space, at most two colors, one clean easing.",
    title: "Logo intro",
  },
  {
    description: "Hook, fast beats, clean loop — 9:16",
    id: "tiktok-vertical",
    prompt:
      "Create a 15-second vertical 9:16 video for TikTok about [topic]. Start with a hook in the first 2 seconds: [hook phrase], big and impossible to ignore. Then 3–4 fast beats, each a short punchy line — [point one], [point two], [point three]. End on a frame that loops cleanly back to the opening. Bold type, high contrast, fast cuts, no dead air.",
    title: "TikTok vertical",
  },
  {
    description: "A line worth reading, elegantly set",
    id: "quote",
    prompt:
      "Create a 12-second quote video. The quote is [quote], attributed to [author]. Reveal it phrase by phrase, giving each phrase room to land, then show the attribution in smaller type. Elegant typography, a quiet textured background, and slow, gentle motion — the words are the star.",
    title: "Quote",
  },
  {
    description: "Words timed to the music",
    id: "lyric-video",
    prompt:
      "Create a 20-second lyric video for [song title]. The lyrics are [lyrics, a few short lines]. Animate the lines one at a time on an even beat — assume [tempo] BPM — each line entering with its own energetic motion, kinetic-typography style. Vary the scale and placement between lines, keep a consistent palette of [two or three colors], and end on the song title.",
    title: "Lyric video",
  },
];
