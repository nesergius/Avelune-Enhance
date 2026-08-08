"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "renderer/out/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer/out/assets/app.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer/out/assets/app.js"), "utf8");
const fetcher = fs.readFileSync(path.join(root, "tools/fetch-official-profile-examples.js"), "utf8");
const buildScript = fs.readFileSync(path.join(root, "tools/build-rc6-release.ps1"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("profile picker uses local official upstream example assets with offline fallbacks", () => {
  assert.match(renderer, /const OFFICIAL_PROFILE_EXAMPLES/);
  assert.match(renderer, /official-realesrgan-x4plus\.jpg/);
  assert.match(renderer, /official-realesrgan-x4plus-anime-6b\.png/);
  assert.match(renderer, /fallback-photo\.svg/);
  assert.match(renderer, /fallback-anime\.svg/);
  assert.match(renderer, /Официальный пример/);
  assert.match(fetcher, /raw\.githubusercontent\.com\/xinntao\/Real-ESRGAN\/master\/assets\/teaser\.jpg/);
  assert.match(fetcher, /cmp_realesrgan_anime_1\.png/);
  assert.match(fetcher, /FAILURE_RETRY_AFTER_MS/);
  assert.match(html, /connect-src 'none'/);
});

test("official model verification is visible and has the exact hover label", () => {
  assert.match(html, /До 6 официальных AI-моделей/);
  assert.match(renderer, /class="official-model-check"/);
  assert.match(renderer, /title="Официальная модель"/);
  assert.match(renderer, /aria-label="Официальная модель"/);
  assert.match(css, /\.official-model-check:hover::after/);
});

test("single image processing does not replace the sidebar footer with a large stop button", () => {
  assert.match(css, /#stop-button\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(renderer, /Cancellation remains available in the compact workspace HUD/);
  assert.doesNotMatch(renderer, /els\.stopButton\.classList\.remove\("hidden"\)/);
  assert.doesNotMatch(renderer, /els\.processingOverlay\.classList\.remove\("hidden"\)/);
  assert.match(css, /body\[data-ui-revision="studio-rc6"\]\s+\.processing-overlay\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(html, /id="workspace-stop-button"/);
  assert.match(html, /id="workspace-stop-text"/);
});

test("development and Windows release builds prepare official examples before packaging", () => {
  assert.equal(pkg.scripts["prepare:profile-examples"], "node tools/fetch-official-profile-examples.js");
  assert.match(pkg.scripts.start, /prepare:official-models/);
  assert.match(pkg.scripts["release:win"], /prepare:profile-examples/);
  assert.match(pkg.scripts["release:win"], /prepare:official-models/);
  assert.match(buildScript, /Preparing official upstream profile examples/);
  assert.match(buildScript, /fetch-official-profile-examples\.js/);
});
