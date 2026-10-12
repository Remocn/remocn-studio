import { ShaderMount, type ShaderMountUniforms } from "@paper-design/shaders";
import { useLayoutEffect, useRef } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

export interface PaperCanvasProps {
  readonly fragment: string;
  readonly onError: (message: string) => void;
  readonly onReady: () => void;
  readonly time: number;
  readonly uniforms: ShaderMountUniforms;
}

function release(mount: ShaderMount | null, element: HTMLDivElement) {
  const canvas = mount?.canvasElement ?? element.querySelector("canvas");
  const gl = canvas?.getContext("webgl2");
  mount?.dispose();
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  canvas?.remove();
}

export function PaperCanvas({
  fragment,
  uniforms,
  time,
  onReady,
  onError,
}: PaperCanvasProps) {
  const element = useRef<HTMLDivElement>(null);
  const mount = useRef<ShaderMount | null>(null);
  const mountedFragment = useRef("");
  const callbacks = useRef({ onError, onReady });
  callbacks.current = { onError, onReady };
  const latest = useRef({ time, uniforms });
  latest.current = { time, uniforms };
  const requestDraw = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const root = element.current;
    if (!root) {
      return;
    }
    try {
      mountedFragment.current = fragment;
      mount.current = new ShaderMount(
        root,
        fragment,
        latest.current.uniforms,
        { preserveDrawingBuffer: true },
        0,
        latest.current.time,
        1,
        8_294_400
      );
    } catch (cause) {
      release(mount.current, root);
      mount.current = null;
      const message =
        cause instanceof Error
          ? cause.message
          : "The shader could not initialize its graphics context.";
      callbacks.current.onError(message);
      cancelRender(new Error(message));
    }
    return () => {
      release(mount.current, root);
      mount.current = null;
    };
  }, [fragment]);

  useLayoutEffect(() => {
    const shader = mount.current;
    if (!shader || mountedFragment.current !== fragment) {
      return;
    }
    let handle: number | null = null;
    let raf = 0;
    let attempts = 0;

    const settle = () => {
      if (handle !== null) {
        continueRender(handle);
        handle = null;
      }
    };
    const fail = (cause: unknown) => {
      const message =
        cause instanceof Error
          ? cause.message
          : "The shader frame could not be drawn.";
      callbacks.current.onError(message);
      cancelRender(new Error(message));
      settle();
    };
    const lost = () =>
      fail(
        new Error(
          "The shader graphics context was lost. Reload the preview before exporting."
        )
      );
    shader.canvasElement.addEventListener("webglcontextlost", lost);
    const draw = () => {
      raf = 0;
      try {
        attempts += 1;
        if (
          shader.canvasElement.width < 1 ||
          shader.canvasElement.height < 1 ||
          attempts < 2
        ) {
          if (attempts >= 120) {
            throw new Error(
              "The shader did not receive a drawable canvas size."
            );
          }
          raf = requestAnimationFrame(draw);
          return;
        }
        const gl = shader.canvasElement.getContext("webgl2");
        if (!gl || gl.isContextLost()) {
          throw new Error("The shader graphics context is unavailable.");
        }
        shader.setUniforms(latest.current.uniforms);
        shader.setFrame(latest.current.time);
        gl.finish();
        const program = gl.getParameter(
          gl.CURRENT_PROGRAM
        ) as WebGLProgram | null;
        if (
          !(program && gl.getProgramParameter(program, gl.LINK_STATUS)) ||
          gl.getError() !== gl.NO_ERROR
        ) {
          throw new Error("The shader could not compile or draw this frame.");
        }
        callbacks.current.onReady();
        settle();
      } catch (cause) {
        fail(cause);
      }
    };
    requestDraw.current = () => {
      if (handle === null) {
        handle = delayRender("Drawing the shader frame");
      }
      if (raf === 0) {
        raf = requestAnimationFrame(draw);
      }
    };
    return () => {
      requestDraw.current = null;
      cancelAnimationFrame(raf);
      shader.canvasElement.removeEventListener("webglcontextlost", lost);
      settle();
    };
  }, [fragment]);

  useLayoutEffect(() => {
    requestDraw.current?.();
  }, [fragment, uniforms, time]);
  return <div ref={element} style={{ inset: 0, position: "absolute" }} />;
}
