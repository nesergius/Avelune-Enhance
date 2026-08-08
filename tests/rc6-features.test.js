"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const renderer = read("renderer", "out", "assets", "app.js");
const html = read("renderer", "out", "index.html");
const main = read("src", "main.js");
const engine = read("src", "engine.js");
const constants = read("src", "constants.js");
const modelFetcher = read("tools", "fetch-official-models.ps1");
const builder = read("tools", "build-rc6-release.ps1");
const pkg = JSON.parse(read("package.json"));
const readme = read("README.md");
const readmeRu = read("README.ru.md");
const releaseNotes = read("RC6-RELEASE-NOTES.md");
const implementationStatus = read("RC6-IMPLEMENTATION-STATUS.md");

test("RC6 pins and verifies distinct official NCNN model resources", () => {
  assert.match(modelFetcher, /Real-ESRGAN\/releases\/download\/v0\.2\.5\.0\/realesrgan-ncnn-vulkan-20220424-windows\.zip/);
  assert.match(modelFetcher, /abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d/);
  for (const model of ["realesrnet-x4plus", "realesr-animevideov3-x2", "realesr-animevideov3-x3", "realesr-animevideov3-x4"]) {
    assert.match(modelFetcher, new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.bin"));
    assert.match(constants, new RegExp(`"${model}"`));
  }
  assert.match(modelFetcher, /byte-identical/);
  assert.match(modelFetcher, /realesrgan-x4plus-anime\.bin/);
  assert.match(modelFetcher, /for \(\$attempt = 1; \$attempt -le 3/);
  assert.match(builder, /fetch-official-models\.ps1/);
  const prepareIndex = builder.indexOf("Downloading and verifying the pinned official NCNN model package");
  const snapshotIndex = builder.indexOf("Prebuilding the source snapshot before dependency installation");
  assert.ok(prepareIndex >= 0 && snapshotIndex > prepareIndex);
});

test("RC6 implements local Auto Profile with explainable metrics", () => {
  assert.match(html, /id="auto-profile-button"/);
  assert.match(renderer, /async function analyzeCurrentImage\(options = \{\}\)/);
  assert.match(renderer, /async function loadAnalysisPixels/);
  assert.match(renderer, /electron\?\.getImagePreview/);
  for (const metric of ["saturation", "edge", "noise", "blockiness", "blur", "colorSpread", "luminance", "megapixels"]) {
    assert.match(renderer, new RegExp(`${metric}:`));
  }
  assert.match(renderer, /function resolveSmartProfile\(metrics, vramBytes\)/);
  assert.match(renderer, /const graphicLike = metrics\.edge > 42/);
  assert.match(renderer, /generative restoration не применён/);
  assert.match(renderer, /Авто-профиль применён/);
  assert.match(renderer, /recommendedTileForVram/);
});

test("RC6 removes the discarded region-preview workflow completely", () => {
  assert.doesNotMatch(html, /preview-region-button|region-preview-dialog|Быстрый preview фрагмента/);
  assert.doesNotMatch(renderer, /previewCacheKey|startRegionPreview|regionPreview/);
  assert.doesNotMatch(constants, /PREVIEW_REGION/);
  assert.doesNotMatch(main, /CHANNELS\.PREVIEW_REGION/);
  for (const doc of [readme, readmeRu, releaseNotes, implementationStatus]) {
    assert.doesNotMatch(doc, /Быстрый preview фрагмента|preview выбранного фрагмента|до 512×512|fragment-preview workflow/);
  }
});

test("public README is English-first and advertises only available local restoration paths", () => {
  assert.match(readme, /Avelune Enhance is a local Windows AI image enhancement and restoration studio/);
  assert.match(readme, /RC6 Highlights/);
  assert.match(readme, /Local AI image enhancement/);
  assert.match(readme, /Photo Restore Pro and Photo Restore Ultra/);
  assert.match(readme, /Adaptive Before\/After viewer/);
  assert.match(readme, /GitHub Releases/);
  assert.match(readme, /Russian version/);
  assert.doesNotMatch(readme, /Основные возможности RC6|Честные ограничения RC6|Готовые Windows-файлы/);
  assert.doesNotMatch(readme, /RC6-IMPLEMENTATION-STATUS|RC6-RUNTIME-QA-CHECKLIST/);
  assert.doesNotMatch(readme, /GPU AutoTune|Release QA gate|Updated production logo|QA-FAILED|packaged smoke tests/);
  assert.match(readmeRu, /Основные возможности RC6/);
  assert.match(readmeRu, /English version/);
  assert.doesNotMatch(readmeRu, /RC6-IMPLEMENTATION-STATUS|RC6-RUNTIME-QA-CHECKLIST/);
  assert.doesNotMatch(readmeRu, /GPU AutoTune|Новый release-gate|Обновлённый логотип|QA-FAILED|packaged smoke tests/);
  assert.doesNotMatch(releaseNotes, /GPU AutoTune|Новый packaged QA gate|Обновлённый логотип|QA-FAILED|repeatable QA/);
  assert.doesNotMatch(readme, /OpenAI GPT Image|api\.openai\.com|облачный профиль|cloud restoration profile/);
  assert.deepEqual(
    pkg.build.files.filter((entry) => /RC6-(?:IMPLEMENTATION-STATUS|RUNTIME-QA-CHECKLIST)/.test(entry)),
    []
  );
});

test("RC6 Smart Queue supports scan pause resume retry and selected files", () => {
  assert.match(html, /SMART QUEUE/);
  assert.match(renderer, /function renderBatchQueue\(\)/);
  assert.match(renderer, /batchPauseButton/);
  assert.match(renderer, /batchResumeButton/);
  assert.match(renderer, /batchRetryButton/);
  assert.match(html, /<button class="[^"]*hidden[^"]*" id="batch-retry-button"/);
  assert.match(renderer, /batchRetryButton\.classList\.toggle\("hidden", !hasFailedItems\)/);
  assert.match(renderer, /files,/);
  assert.match(constants, /SCAN_BATCH_FOLDER/);
  assert.match(constants, /PAUSE_BATCH/);
  assert.match(constants, /RESUME_BATCH/);
  assert.match(engine, /payload\.files/);
  assert.match(engine, /state: "failed"/);
  assert.match(engine, /skipExisting/);
});

test("RC6 exposes an honest two-network neural restoration cascade", () => {
  assert.match(html, /id="neural-restore-toggle"/);
  assert.match(html, /Глубокое нейровосстановление/);
  assert.match(html, /Полностью утраченные детали нейросеть создаёт правдоподобно/);
  assert.match(renderer, /"avelune-neural-restore"/);
  assert.match(engine, /Нейровосстановление 1\/2/);
  assert.match(engine, /Нейровосстановление 2\/2/);
  assert.match(engine, /model: "realesrnet-x4plus"/);
  assert.match(engine, /model: "avelune-standard-4x"/);
  assert.match(engine, /mapStageProgress/);
  assert.match(html, /GFPGAN 1\.4 \+ Real-ESRGAN/);
  assert.match(read("src", "local-ai.js"), /restoreLocal/);
});

test("RC6 preserves compatible metadata and color profiles", () => {
  assert.match(html, /id="copy-metadata-toggle"/);
  assert.match(html, /id="preserve-color-toggle"/);
  assert.match(engine, /preserveMetadataSafely/);
  assert.match(read("src", "metadata.js"), /JPEG_METADATA_MARKERS/);
  assert.match(read("src", "metadata.js"), /PNG_COPY_CHUNKS/);
  assert.match(read("src", "metadata.js"), /WEBP_COPY_CHUNKS/);
});

test("RC6 GPU AutoTune and OOM fallback are wired end to end", () => {
  assert.match(html, /id="gpu-autotune-button"/);
  assert.match(renderer, /async function runGpuAutotune\(\)/);
  assert.match(constants, /RUN_GPU_BENCHMARK/);
  assert.match(main, /benchmark-input\.png/);
  assert.match(engine, /runEngineWithTileFallback/);
  assert.match(engine, /256, 128, 64/);
  assert.match(engine, /vk_error_out_of_device_memory/);
});

test("RC6 build gate uses multi-viewport screenshots and preserves failed artifacts", () => {
  for (const spec of ["1280x720@100%", "1366x768@100%", "1920x1080@100%", "1366x768@125%", "1920x1080@150%"])
    assert.match(builder, new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(main, /capturePage\(\)/);
  assert.match(main, /failedChecks/);
  assert.match(builder, /QA-FAILED/);
  assert.match(builder, /QA-FAILURES\.txt/);
  assert.match(builder, /PackagedVisualRegressionScreenshotsCaptured = \$true/);
});

test("RC6 uses the refreshed transparent production logo", () => {
  const icon = fs.readFileSync(path.join(root, "renderer", "out", "assets", "icon-512.png"));
  assert.ok(icon.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  assert.ok([4, 6].includes(icon[25]), "PNG must include an alpha channel");
  assert.equal(pkg.build.win.icon, "renderer/out/assets/avelune-enhance.ico");
  assert.ok(fs.existsSync(path.join(root, "renderer", "out", "assets", "avelune-enhance.ico")));
});

test("RC6 model fetcher uses the official legacy package only for pinned RealESRNet fallback", () => {
  assert.match(modelFetcher, /v0\.2\.3\.0\/realesrgan-ncnn-vulkan-20211212-windows\.zip/);
  assert.match(modelFetcher, /26bccfcc82d9e8260c0c6b0dffb34ab297982740882d1f33c6d423f70b562c40/);
  assert.match(modelFetcher, /35330ececcea33b6c397a72548e788d5d53becee4734c50b7fada36e89f10a86/);
  assert.match(modelFetcher, /Current package omits RealESRNet/);
  assert.doesNotMatch(modelFetcher, /foreach \(\$name in \$Required\).*realesrnet-x4plus/s);
});
