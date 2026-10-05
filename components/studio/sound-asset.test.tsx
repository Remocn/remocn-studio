import { expect, it } from "bun:test";
import { mockConvertFileSrc } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset } from "@/shared/library";
import { SoundAsset } from "./sound-asset";

it("offers local playback without autoplay or project insertion and shows provenance", async () => {
  mockConvertFileSrc("macos");
  const asset: Asset = {
    audiomap: null,
    category: null,
    clip: null,
    createdAt: 1,
    dependencies: [],
    description: "Door",
    duration: null,
    files: ["sound_1.mp3"],
    name: "Door",
    path: "/library/door",
    preview: null,
    proxied: false,
    role: null,
    slug: "door",
    source: {
      author: "Mine",
      authorUrl: "",
      connectionId: "cn_1",
      connectionName: "Mine",
      durationSeconds: 2,
      format: "mp3_44100_128",
      id: "sound_1",
      model: "eleven_text_to_sound_v2",
      provider: "elevenlabs",
      text: "A door closing",
      url: "https://elevenlabs.io/sound-effects",
    },
    type: "audio",
  };
  render(<SoundAsset asset={asset} />);
  const player = screen.getByLabelText("Listen to Door");
  expect(screen.getByRole("button", { name: "Play Door" })).toBeEnabled();
  expect(player).toHaveAttribute("preload", "none");
  expect(player).not.toHaveAttribute("autoplay");
  expect(player.getAttribute("src")).toContain("sound_1.mp3");
  expect(player.getAttribute("src")).not.toContain("elevenlabs.io");
  await userEvent.click(
    screen.getByRole("button", { name: "Audio controls for Door" })
  );
  expect(screen.getByRole("slider", { name: "Seek Door" })).toBeDisabled();
  expect(screen.getByRole("slider", { name: "Volume for Door" })).toBeEnabled();
  expect(screen.getByText("ElevenLabs · Mine")).toBeInTheDocument();
  expect(screen.getByText("A door closing")).toBeInTheDocument();
});
