import React from "react";
import { createRoot } from "react-dom/client";
import { CausticsAdapter } from "../../../templates/remotion/src/lib/studio-shaders-v1/caustics";
import { StrataAdapter } from "../../../templates/remotion/src/lib/studio-shaders-v1/strata";
import { WeaveAdapter } from "../../../templates/remotion/src/lib/studio-shaders-v1/weave";
import caustics from "../../../templates/remotion/src/lib/studio-shaders-v1/descriptors/shader-caustics.json";
import strata from "../../../templates/remotion/src/lib/studio-shaders-v1/descriptors/shader-strata.json";
import weave from "../../../templates/remotion/src/lib/studio-shaders-v1/descriptors/shader-weave.json";

const results = new Map();
let complete = false;
function finish(body: object) {
  if (complete) return;
  complete = true;
  (window as any).webkit.messageHandlers.result.postMessage(JSON.stringify(body));
}
window.addEventListener("error", event => finish({ok: false, message: event.message}));
const entries = [["caustics", CausticsAdapter, caustics], ["strata", StrataAdapter, strata], ["weave", WeaveAdapter, weave]] as const;
function ready(name: string) {
  const canvas = document.getElementById(name)?.querySelector("canvas");
  const gl = canvas?.getContext("webgl2");
  if (!canvas || !gl) return finish({ok: false, message: "Missing canvas"});
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const colors = new Set<string>();
  for (let i=0; i<pixels.length; i+=4) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
  results.set(name, {name, colors: colors.size, precision: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT)?.precision});
  if (results.size === entries.length) finish({ok: [...results.values()].every(r=>r.colors>1), results:[...results.values()]});
}
createRoot(document.body).render(<>{entries.map(([name, Adapter, descriptor], index) => <div id={name} key={name} style={{position:"absolute",width:320,height:180,top:index*180,left:0}}><Adapter frame={72} fps={24} values={Object.fromEntries(descriptor.definition.fields.map(field=>[field.id,field.default]))} onReady={()=>ready(name)} onError={message=>finish({ok:false,message})}/></div>)}</>);
