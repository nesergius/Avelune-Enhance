#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "renderer", "out", "assets", "profile-examples");
const manifestPath = path.join(outputDir, "official-examples-manifest.json");
const MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const FAILURE_RETRY_AFTER_MS = 10 * 60 * 1000;

const examples = [
  {
    id: "realesrgan-x4plus",
    filename: "official-realesrgan-x4plus.jpg",
    mediaType: "image/jpeg",
    minBytes: 100000,
    sources: [
      "https://raw.githubusercontent.com/xinntao/Real-ESRGAN/master/assets/teaser.jpg",
      "https://github.com/xinntao/Real-ESRGAN/raw/master/assets/teaser.jpg"
    ],
    upstreamPage: "https://github.com/xinntao/Real-ESRGAN",
    description: "Official Real-ESRGAN comparison teaser for the general RealESRGAN_x4plus model."
  },
  {
    id: "realesrgan-x4plus-anime-6b",
    filename: "official-realesrgan-x4plus-anime-6b.png",
    mediaType: "image/png",
    minBytes: 100000,
    sources: [
      "https://raw.githubusercontent.com/xinntao/public-figures/master/Real-ESRGAN/cmp_realesrgan_anime_1.png",
      "https://github.com/xinntao/public-figures/raw/master/Real-ESRGAN/cmp_realesrgan_anime_1.png"
    ],
    upstreamPage: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_model.md",
    description: "Official comparison published for RealESRGAN_x4plus_anime_6B."
  }
];

function isExpectedImage(buffer, example) {
  if (!Buffer.isBuffer(buffer) || buffer.length < example.minBytes || buffer.length > MAX_BYTES) return false;
  if (example.mediaType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
}

function requestBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "Avelune-Enhance-RC6-Build/1.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    }, response => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location && redirectsLeft > 0) {
        response.resume();
        const redirected = new URL(response.headers.location, url).toString();
        requestBuffer(redirected, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on("data", chunk => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          request.destroy(new Error("Official example exceeds the size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("Download timed out.")));
    request.on("error", reject);
  });
}

async function fetchExample(example) {
  const target = path.join(outputDir, example.filename);
  try {
    const cached = fs.readFileSync(target);
    if (isExpectedImage(cached, example)) {
      return { ...example, source: "cached", bytes: cached.length, sha256: crypto.createHash("sha256").update(cached).digest("hex") };
    }
  } catch {
    // Missing cache is expected on a clean source tree.
  }

  let lastError = null;
  for (const source of example.sources) {
    for (let attempt = 1; attempt <= 1; attempt += 1) {
      try {
        process.stdout.write(`[profile-examples] Downloading ${example.id}...\n`);
        const buffer = await requestBuffer(source);
        if (!isExpectedImage(buffer, example)) throw new Error("Downloaded file is not the expected image type or size.");
        const temporary = `${target}.tmp-${process.pid}`;
        fs.writeFileSync(temporary, buffer);
        fs.renameSync(temporary, target);
        return { ...example, source, bytes: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw new Error(`${example.id}: ${lastError?.message || "download failed"}`);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  // The release builder prepares the source snapshot and electron-builder may
  // invoke this script again. Do not repeat a slow failed GitHub request twice
  // during the same build; retry automatically on a later build.
  try {
    const previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const generatedAt = Date.parse(previous.generatedAt || "");
    const recentFailure = Array.isArray(previous.failures) && previous.failures.length > 0
      && Number.isFinite(generatedAt)
      && Date.now() - generatedAt < FAILURE_RETRY_AFTER_MS;
    if (recentFailure) {
      process.stderr.write("[profile-examples] Previous download attempt failed recently; keeping local fallbacks for this build.\n");
      return;
    }
  } catch {
    // A missing or malformed manifest simply means this is the first attempt.
  }

  const results = [];
  const failures = [];
  for (const example of examples) {
    try {
      results.push(await fetchExample(example));
    } catch (error) {
      failures.push(error.message);
      process.stderr.write(`[profile-examples] WARNING: ${error.message}\n`);
    }
  }

  const manifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    purpose: "Official upstream examples shown in the Avelune profile picker. No user images are transmitted.",
    licenseNotice: "Real-ESRGAN materials are attributed to Xintao Wang and contributors under the repository BSD-3-Clause notice. Image rights remain with their respective owners.",
    examples: results.map(({ sources, ...entry }) => entry),
    failures
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (failures.length) {
    process.stderr.write("[profile-examples] Official images could not be downloaded. The application will use its local fallback artwork.\n");
    process.exitCode = 0;
    return;
  }
  process.stdout.write(`[profile-examples] Ready: ${results.length}/${examples.length} official examples.\n`);
}

main().catch(error => {
  process.stderr.write(`[profile-examples] WARNING: ${error.stack || error.message}\n`);
  process.exitCode = 0;
});
