import {
  getShaderColorFromString,
  getShaderNoiseTexture,
  ShaderFitOptions,
  type ShaderMountUniforms,
} from "@paper-design/shaders";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { ShaderAdapterProps } from "../studio-objects-v7/shaders";
import { PaperCanvas } from "./paper";
import { type ParameterField, parameters } from "./parameters";

interface Binding {
  readonly options?: Readonly<Record<string, number>>;
  readonly uniform: string;
}
interface Textures {
  readonly image: boolean;
  readonly isImage: boolean;
  readonly noise: boolean;
}
export function paperUniforms(
  fields: readonly ParameterField[],
  values: ShaderAdapterProps["values"],
  bindings: Readonly<Record<string, Binding>>
) {
  const p = parameters(fields, values);
  const uniforms: ShaderMountUniforms = {
    u_fit: ShaderFitOptions[p.fit as keyof typeof ShaderFitOptions],
    u_offsetX: p.offsetX as number,
    u_offsetY: p.offsetY as number,
    u_originX: p.originX as number,
    u_originY: p.originY as number,
    u_rotation: p.rotation as number,
    u_scale: p.scale as number,
    u_worldHeight: 0,
    u_worldWidth: 0,
  };
  for (const field of fields) {
    const binding = bindings[field.id];
    if (!binding) {
      continue;
    }
    const value = p[field.id];
    if (field.type === "palette") {
      uniforms[binding.uniform] = (value as readonly string[]).map(
        getShaderColorFromString
      );
      uniforms.u_colorsCount = (value as readonly string[]).length;
    } else if (field.type === "color") {
      uniforms[binding.uniform] = getShaderColorFromString(value as string);
    } else if (binding.options) {
      uniforms[binding.uniform] = binding.options[value as string];
    } else {
      uniforms[binding.uniform] = value as number | boolean;
    }
  }
  return { speed: p.speed as number, uniforms };
}

// Resolve internal textures before mounting: ShaderMount rejects an undecoded image.
function useTextures(config: Textures, onError: ShaderAdapterProps["onError"]) {
  const [textures, setTextures] = useState<ShaderMountUniforms | null>(null);
  const callback = useRef(onError);
  const release = useRef<(() => void) | null>(null);
  callback.current = onError;
  useLayoutEffect(() => {
    let active = true;
    const handle = delayRender("Loading shader textures");
    const images: Record<string, HTMLImageElement> = {};
    if (config.noise) {
      const noise = getShaderNoiseTexture();
      if (noise) {
        images.u_noiseTexture = noise;
      }
    }
    if (config.image) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const image = new Image();
      image.src = canvas.toDataURL();
      images.u_image = image;
    }
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };
    release.current = settle;
    Promise.all(Object.values(images).map((image) => image.decode()))
      .then(() => {
        if (active) {
          setTextures({
            ...images,
            ...(config.isImage ? { u_isImage: false } : {}),
          });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          const error =
            cause instanceof Error
              ? cause
              : new Error("Could not load shader textures.");
          callback.current(error.message);
          cancelRender(error);
        }
        settle();
      });
    return () => {
      active = false;
      settle();
    };
  }, [config]);
  useLayoutEffect(() => {
    // The child canvas has now mounted and acquired its own frame gate.
    if (textures) {
      release.current?.();
    }
  }, [textures]);
  return textures;
}

export function createPaperAdapter(
  fragment: string,
  fields: readonly ParameterField[],
  bindings: Readonly<Record<string, Binding>>,
  config: Textures
) {
  return function PaperShaderAdapter({
    values,
    frame,
    fps,
    onReady,
    onError,
  }: ShaderAdapterProps) {
    const textures = useTextures(config, onError);
    const encoded = JSON.stringify(values);
    const data = useMemo(
      () => paperUniforms(fields, JSON.parse(encoded), bindings),
      [encoded]
    );
    const uniforms = useMemo(
      () => ({ ...data.uniforms, ...textures }),
      [data, textures]
    );
    return textures ? (
      <PaperCanvas
        fragment={fragment}
        onError={onError}
        onReady={onReady}
        time={(frame / fps) * data.speed * 1000}
        uniforms={uniforms}
      />
    ) : null;
  };
}
