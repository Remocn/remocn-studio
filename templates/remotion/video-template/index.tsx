import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { StudioObjects, useStudioObject } from "../../lib/studio-objects-v7";
import { StudioShaderSlot } from "../../lib/studio-objects-v7/shaders";
import { shaderRegistry } from "./shader-registry";
import document from "./studio.json";
import shaderManifest from "./studio-shaders.json";

export const meta = {
  durationInFrames: 150,
  fps: 30,
  height: 1080,
  width: 1920,
};

function Heading({ id }: { id: string }) {
  const object = useStudioObject(id);
  const geometry = object.geometry({
    height: "height",
    rotation: "rotation",
    width: "width",
    x: "x",
    y: "y",
  });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const easing = Easing.bezier(...object.easing("entryEasing"));
  const progress = interpolate(
    frame,
    [0, object.number("entryDuration") * fps],
    [0, 1],
    {
      easing,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  return (
    <h1
      {...object.bind}
      {...geometry.bind}
      {...object.bindText("text")}
      style={{
        ...geometry.style,
        color: object.text("color"),
        fontSize: object.number("fontSize"),
        fontWeight: object.number("fontWeight"),
        letterSpacing: object.number("letterSpacing"),
        lineHeight: object.number("lineHeight"),
        margin: 0,
        opacity: progress,
        textAlign: "center",
        translate: `${(1 - progress) * -object.number("entryDistance")}px 0px`,
      }}
    >
      {object.text("text")}
    </h1>
  );
}

function Backdrop() {
  const object = useStudioObject("backdrop");
  return (
    <AbsoluteFill
      {...object.bind}
      style={{ backgroundColor: object.text("color") }}
    />
  );
}

export default function Video() {
  const { durationInFrames } = useVideoConfig();
  return (
    <StudioObjects document={document}>
      <AbsoluteFill
        style={{
          fontFamily: "sans-serif",
        }}
      >
        <Backdrop />
        <StudioShaderSlot
          durationInFrames={durationInFrames}
          id="root-shaders"
          label="Whole video"
          registry={shaderRegistry}
          sourceRevision={shaderManifest.sourceRevision}
        />
        <Heading id="heading" />
        <Heading id="subtitle" />
      </AbsoluteFill>
    </StudioObjects>
  );
}
