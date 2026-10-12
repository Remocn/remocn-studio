"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { AudioTransport } from "@/components/studio/audio-transport";
import { NewVideoWizard } from "@/components/studio/new-video-wizard";
import { SoundAssetView } from "@/components/studio/sound-asset";
import { Splash } from "@/components/studio/splash";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useNewVideo } from "@/hooks/use-new-video";
import type { VideoFormat } from "@/lib/studio/formats";
import { LIBRARY_ASSETS } from "../assets";

const SAMPLE_ASSET = {
  ...LIBRARY_ASSETS[2],
  duration: 8,
  name: "Cinematic transition",
};

function LibraryAudioExample({ url }: { url: string | null }) {
  const player = useAudioPlayer(null);
  return <SoundAssetView asset={SAMPLE_ASSET} player={{ ...player, url }} />;
}

function audioSample() {
  const rate = 8000;
  const frames = rate * 8;
  const bytes = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i += 1) {
    const fade = Math.min(1, i / 800, (frames - i) / 800);
    view.setInt16(
      44 + i * 2,
      Math.sin((i / rate) * Math.PI * 440) * 600 * fade,
      true
    );
  }
  return new Blob([bytes], { type: "audio/wav" });
}

function AudioExample({ source }: { source: "ready" | "missing" | "empty" }) {
  const [url, setUrl] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  useEffect(() => {
    if (source === "empty") {
      return;
    }
    const sample =
      source === "ready"
        ? audioSample()
        : new Blob(["invalid audio"], { type: "audio/wav" });
    const sampleUrl = URL.createObjectURL(sample);
    setUrl(sampleUrl);
    return () => URL.revokeObjectURL(sampleUrl);
  }, [source]);
  return (
    <section
      aria-label="Audio playback"
      className="flex max-w-xl flex-col gap-3"
    >
      <AudioTransport name="Local sample" player={{ ...player, url }} />
      <LibraryAudioExample url={url} />
      {player.error === null ? null : (
        <p className="text-destructive text-xs" role="alert">
          {player.error}
        </p>
      )}
      <output
        aria-label="Playback state"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {player.playing ? "Playing" : "Paused"} · {player.position.toFixed(1)} /{" "}
        {player.duration.toFixed(1)} s
      </output>
    </section>
  );
}

export default function MediaFixture() {
  const { setTheme } = useTheme();
  const [source, setSource] = useState<"ready" | "missing" | "empty">("ready");
  const [created, setCreated] = useState("No video created");
  const [splash, setSplash] = useState(false);
  const light = useCallback(() => setTheme("light"), [setTheme]);
  const dark = useCallback(() => setTheme("dark"), [setTheme]);
  const ready = useCallback(() => setSource("ready"), []);
  const missing = useCallback(() => setSource("missing"), []);
  const empty = useCallback(() => setSource("empty"), []);
  const showSplash = useCallback(() => setSplash(true), []);
  const hideSplash = useCallback(() => setSplash(false), []);
  const create = useCallback((name: string, format: VideoFormat) => {
    setCreated(`${name} · ${format.width}×${format.height}`);
    return Promise.resolve(null);
  }, []);
  const video = useNewVideo(create);
  return (
    <main className="h-dvh overflow-auto bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto font-semibold text-xl">Media and creation</h1>
          <Button onClick={light} variant="outline">
            Light
          </Button>
          <Button onClick={dark} variant="outline">
            Dark
          </Button>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button onClick={ready} variant="outline">
            Playable audio
          </Button>
          <Button onClick={missing} variant="outline">
            Invalid audio
          </Button>
          <Button onClick={empty} variant="outline">
            No audio
          </Button>
          <Button onClick={showSplash} variant="outline">
            Preview startup
          </Button>
        </div>
        <AudioExample key={source} source={source} />
        <section
          aria-label="Video creation"
          className="flex w-full max-w-[640px] flex-col gap-3"
        >
          {video.isOpen ? (
            <NewVideoWizard
              control={video}
              entrance={null}
              project="Product launch"
            />
          ) : (
            <Button className="self-start" onClick={video.open}>
              New video
            </Button>
          )}
          <output
            aria-label="Created video"
            className="text-muted-foreground text-xs"
          >
            {created}
          </output>
        </section>
      </div>
      {splash ? <Splash isSettled onGone={hideSplash} /> : null}
    </main>
  );
}
