// Static capture of components/studio/startup-backdrop.tsx and shader-field.tsx.
// Keep the palette, opacity, mask, and shader parameters aligned with those files.
import {
  getShaderColorFromString,
  neuroNoiseFragmentShader,
  ShaderMount,
} from "@paper-design/shaders";

const shader = new ShaderMount(
  document.getElementById("shader"),
  neuroNoiseFragmentShader,
  {
    u_brightness: 0.16,
    u_colorBack: getShaderColorFromString("rgba(0, 0, 0, 0)"),
    u_colorFront: getShaderColorFromString("rgba(196, 181, 253, 0.45)"),
    u_colorMid: getShaderColorFromString("rgba(124, 58, 237, 0.55)"),
    u_contrast: 0.26,
    u_fit: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_rotation: 0,
    u_scale: 2.4,
    u_worldHeight: 0,
    u_worldWidth: 0,
  },
  { preserveDrawingBuffer: true },
  0,
  120,
  1,
  1920 * 1080
);

window.addEventListener("pagehide", () => shader.dispose(), { once: true });
