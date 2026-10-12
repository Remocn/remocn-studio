import { useLayoutEffect, useRef } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useVideoConfig,
} from "remotion";
import type { ShaderAdapterProps } from "../studio-objects-v7/shaders";
import descriptor from "./descriptors/shader-light-tunnel.json";
import { parameters } from "./parameters";
import { createTunnelRenderer } from "./tunnel-renderer";

export function LightTunnelAdapter({
  values,
  frame,
  fps,
  onReady,
  onError,
}: ShaderAdapterProps) {
  const { width, height } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createTunnelRenderer> | null>(null);
  const callbacks = useRef({ onError, onReady });
  callbacks.current = { onError, onReady };
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) {
      return;
    }
    const fail = (error: Error) => {
      callbacks.current.onError(error.message);
      cancelRender(error);
    };
    const lost = () =>
      fail(
        new Error("The tunnel graphics context was lost. Reload the preview.")
      );
    element.addEventListener("webglcontextlost", lost);
    try {
      renderer.current = createTunnelRenderer(element);
    } catch (cause) {
      fail(cause instanceof Error ? cause : new Error(String(cause)));
    }
    return () => {
      element.removeEventListener("webglcontextlost", lost);
      renderer.current?.dispose();
      renderer.current = null;
      element
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext();
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Resizing a canvas clears its buffer, even on a paused frame.
  useLayoutEffect(() => {
    const handle = delayRender("Drawing Light Tunnel");
    try {
      if (!renderer.current) {
        throw new Error("The tunnel renderer is unavailable.");
      }
      const p = parameters(descriptor.definition.fields, values);
      renderer.current.draw(
        Number(p.timeOffset) + (frame / fps) * Number(p.speed),
        Number(p.twist),
        Number(p.glow),
        Number(p.depth),
        Number(p.spirals),
        Number(p.patternScale),
        Number(p.rotation),
        Number(p.offsetX),
        Number(p.offsetY)
      );
      const gl = canvas.current?.getContext("webgl2");
      if (!gl || gl.isContextLost()) {
        throw new Error("The tunnel graphics context is unavailable.");
      }
      gl.finish();
      if (gl.getError() !== gl.NO_ERROR) {
        throw new Error("Light Tunnel could not draw this frame.");
      }
      callbacks.current.onReady();
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      callbacks.current.onError(error.message);
      cancelRender(error);
    } finally {
      continueRender(handle);
    }
  }, [values, frame, fps, width, height]);
  return (
    <canvas
      height={height}
      ref={canvas}
      style={{
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
      }}
      width={width}
    />
  );
}
