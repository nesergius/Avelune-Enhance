"use strict";

const fs = require("fs/promises");
const path = require("path");

const API_URL = "https://api.openai.com/v1/images/edits";
const MAX_CLOUD_INPUT_BYTES = 50 * 1024 * 1024;

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function validateApiKey(value) {
  const key = String(value || "").trim();
  if (key.length < 20 || !/^sk-[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Ключ OpenAI API не настроен или имеет неверный формат.");
  }
  return key;
}

function restorationPrompt({ fidelity = 90 } = {}) {
  const strength = Math.max(50, Math.min(100, Number(fidelity) || 90));
  return [
    "Restore this exact photograph from extremely low quality into a clean, highly detailed, photorealistic image.",
    "Preserve the same person, identity, facial proportions, gaze, expression, pose, framing, lighting, colors, background and every visible object.",
    "Remove block compression, pixelation, ringing, banding, noise, blur and resampling artifacts.",
    "Reconstruct plausible natural skin texture, eyelashes, iris detail, hair strands and fabric texture only where the source clearly implies them.",
    "Do not beautify, redesign, change age, change ethnicity, change makeup, change eye shape, add objects, crop, zoom, or alter composition.",
    `Identity and composition fidelity priority: ${strength}/100. Output one restored photograph only, without borders or text.`
  ].join(" ");
}

async function restoreWithOpenAI({ inputPath, outputPath, apiKey, signal, onProgress, fidelity = 90 }) {
  const key = validateApiKey(apiKey);
  const stat = await fs.stat(inputPath);
  if (!stat.isFile() || stat.size <= 0) throw new Error("Исходное изображение не найдено.");
  if (stat.size > MAX_CLOUD_INPUT_BYTES) throw new Error("Изображение слишком большое для облачного восстановления (максимум 50 МБ).");

  onProgress?.("3%\n");
  onProgress?.("Облачное нейровосстановление: защищённая отправка изображения\n");
  const bytes = await fs.readFile(inputPath);
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", new Blob([bytes], { type: mimeFor(inputPath) }), path.basename(inputPath));
  form.append("prompt", restorationPrompt({ fidelity }));
  form.append("input_fidelity", "high");
  form.append("quality", "high");
  form.append("size", "auto");
  form.append("output_format", "png");
  form.append("n", "1");

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(new Error("OpenAI API не ответил за 10 минут.")), 10 * 60 * 1000);
  const abort = () => timeoutController.abort(signal?.reason || new Error("Задача отменена."));
  signal?.addEventListener("abort", abort, { once: true });
  try {
    onProgress?.("10%\n");
    onProgress?.("OpenAI Generative Restore: реконструкция утраченных деталей\n");
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: timeoutController.signal
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = json?.error?.message || `HTTP ${response.status}`;
      throw new Error(`OpenAI API: ${detail}`);
    }
    const encoded = json?.data?.[0]?.b64_json;
    if (typeof encoded !== "string" || encoded.length < 100) throw new Error("OpenAI API не вернул изображение результата.");
    const result = Buffer.from(encoded, "base64");
    if (result.length < 32) throw new Error("OpenAI API вернул пустой результат.");
    await fs.writeFile(outputPath, result, { flag: "wx", mode: 0o600 });
    onProgress?.("65%\n");
    return outputPath;
  } catch (error) {
    if (timeoutController.signal.aborted && signal?.aborted) throw signal.reason || new Error("Задача отменена.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

module.exports = { API_URL, validateApiKey, restorationPrompt, restoreWithOpenAI };
