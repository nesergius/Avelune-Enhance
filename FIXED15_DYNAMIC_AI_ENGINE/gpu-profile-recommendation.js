
// Avelune FIXED15 Dynamic AI Engine
// Frontend integration helper for GPU-aware recommendations.

export function recommendProfile(gpu = {}) {
  const vram = Number(gpu.vram || 0);
  if (vram >= 8) return {profile:"ultra", label:"Recommended: Maximum Quality"};
  if (vram >= 6) return {profile:"restore", label:"Recommended: Neural Restore"};
  if (vram >= 4) return {profile:"natural", label:"Recommended: Balanced"};
  return {profile:"natural", label:"Recommended: Lightweight Mode"};
}

export const AI_BACKENDS = {
  natural: "Real-ESRGAN x4plus",
  restore: "RealESRNet + GFPGAN + Real-ESRGAN",
  ultra: "DiffBIR + GFPGAN + Real-ESRGAN",
  art: "AnimeVideo + Real-ESRGAN"
};
