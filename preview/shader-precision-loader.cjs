"use strict";

// Paper 0.0.78's vertex shader defaults to mediump. Its mount promotes both
// stages on GPUs with <23-bit mediump; WebKit on Apple reports 23 and retains
// the declarations, as does Chromium ANGLE on Apple GPUs. Shared uniforms
// must agree in both preview and export.
// Keep the custom fragment's highp arithmetic, and the saved source, intact.
module.exports = function shaderPrecisionLoader(source) {
  return source.replace(
    /\buniform (vec2 u_resolution|float u_rotation|float u_scale);/g,
    "uniform mediump $1;"
  );
};
