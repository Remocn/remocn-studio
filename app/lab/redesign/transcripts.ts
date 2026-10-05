import type { TranscriptEntry } from "@/shared/ipc";

function user(id: string, text: string): TranscriptEntry {
  return {
    assets: [],
    attachments: [],
    elements: [],
    id,
    kind: "user",
    media: [],
    text,
  };
}

export const TRANSCRIPTS: Record<string, TranscriptEntry[]> = {
  "session-1": [
    user(
      "opening-request",
      "Create an opening scene for our product launch. Keep the typography calm and give the message enough time to read."
    ),
    {
      id: "opening-answer",
      kind: "assistant",
      text: `## Opening scene\n\nThe first scene introduces the product with one clear statement. The heading stays visible long enough to read before the supporting copy appears.\n\n### Timing\n\n1. **0–1.2 seconds:** the title enters with a gentle vertical movement.\n2. **1.2–3.6 seconds:** the supporting line appears and the scene holds.\n3. **3.6–5 seconds:** the composition transitions into the product demo.\n\n### Layout\n\nThe heading uses the project’s display family. Supporting text uses the body family, with a narrower measure so the two lines feel like one group. There is enough space around the title to preserve its hierarchy at smaller preview sizes.\n\n| Element | Size | Alignment |\n| --- | --- | --- |\n| Heading | 72 px | Left |\n| Supporting copy | 28 px | Left |\n| Product label | 18 px | Left |\n\n### Implementation\n\nThe scene is editable. Text, background, duration and entry timing are exposed in the inspector. The source stays in the project:\n\n\`src/videos/product-launch/scenes/OpeningScene.tsx\`\n\n\`\`\`tsx\n<OpeningScene\n  title="Make something worth watching."\n  subtitle="From an idea to a finished film."\n/>\n\`\`\`\n\nI kept the background neutral and used the brand accent only for the final call to action. The opening itself depends on contrast and spacing.\n\n### Before exporting\n\n- Preview the transition into the second scene.\n- Check the title in both landscape and portrait compositions.\n- Listen to the first five seconds with the soundtrack enabled.\n\nThe complete scene is ready to inspect and refine.`,
    },
  ],
  "session-2": [
    user(
      "review-request",
      "Run design_check and show the typography findings."
    ),
    {
      id: "review-result",
      input: { mode: "full" },
      kind: "activity",
      name: "mcp__remocn-design__design_check",
      result: JSON.stringify({
        composition: "Launch film",
        findings: [
          {
            code: "contrast",
            fix: "Use the foreground token for body text and preserve at least 4.5:1 contrast.",
            frames: [24, 48],
            message:
              "Supporting copy needs more contrast over the opening background.",
            selector: "#subtitle",
            severity: "warning",
          },
          {
            code: "spacing",
            fix: "Reduce the gap from 32 px to 24 px.",
            frames: [48],
            message: "The title and subtitle can form a tighter visual group.",
            selector: "#title-group",
            severity: "info",
          },
          {
            code: "safe-area",
            fix: "Move the footer 48 px inward before adapting the scene to 9:16.",
            frames: [96],
            message: "The footer is outside the portrait safe area.",
            selector: "#footer",
            severity: "error",
          },
          {
            code: "timing",
            fix: "Extend the scene hold without changing the entry animation.",
            frames: [72],
            message: "Hold the settled title for another half second.",
            selector: "#title",
            severity: "info",
          },
        ],
        readiness: { coverage: { complete: true } },
      }),
      state: "done",
      verb: null,
    },
    {
      id: "review-answer",
      kind: "assistant",
      text: "The review found one improvement, one caution and two observations. Open a finding to see the affected frames and the suggested change.",
    },
  ],
  "session-3": [
    user(
      "sound-request",
      "Generate a soft wooden door closing sound for the end of the opening scene."
    ),
    {
      id: "sound-result",
      kind: "sound",
      result: {
        asset: {
          audiomap: null,
          category: null,
          clip: null,
          createdAt: 1,
          dependencies: [],
          description: "A wooden door closing softly",
          duration: 2,
          files: ["door.mp3"],
          name: "Wooden door",
          path: "/fixture/audio",
          preview: null,
          proxied: false,
          role: null,
          slug: "wooden-door",
          source: null,
          type: "audio",
        },
        operationId: "sound-door",
        request: {
          connectionId: "connection-1",
          durationSeconds: 2,
          format: "mp3_44100_128",
          name: "Wooden door",
          text: "A wooden door closing softly, with a short natural room tail.",
        },
      },
    },
    {
      id: "sound-answer",
      kind: "assistant",
      text: "The sound is saved to the library. You can preview it, regenerate a variation, or ask to place it at the end of the opening scene.",
    },
  ],
};
