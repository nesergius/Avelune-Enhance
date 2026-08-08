"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "renderer/out/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer/out/assets/app.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer/out/assets/app.js"), "utf8");

test("UI v10 exposes a rich profile picker without replacing the compatible select", () => {
  assert.match(html, /data-ui-revision="studio-rc6"/);
  assert.match(html, /id="model-picker-button"/);
  assert.match(html, /id="model-picker-dialog"/);
  assert.match(html, /id="profile-choice-grid"/);
  assert.match(html, /model-picker-device-card/);
  assert.match(html, /id="extra-model-select"/);
  assert.match(renderer, /function renderProfilePicker\(\)/);
  assert.match(renderer, /function AIProfileCard\(profileId\)/);
  assert.match(renderer, /profiles\.map\(AIProfileCard\)/);
  assert.match(renderer, /data-profile-id/);
  assert.match(renderer, /ai-profile-identity/);
  assert.doesNotMatch(renderer, /official-profile-example img/);
  assert.doesNotMatch(renderer, /<\/span>\s*<span class="official-example-label">/);
});

test("profile picker communicates real base models and processing modes", () => {
  assert.match(renderer, /const PROFILE_PRESENTATION/);
  assert.match(renderer, /base: "Real-ESRGAN x4plus"/);
  assert.match(renderer, /base: "Anime 6B"/);
  assert.match(renderer, /config\.ttaMode \? "TTA" : "Standard"/);
  assert.match(renderer, /function getProfileMetrics/);
  assert.match(css, /profile-choice-stats/);
  assert.match(css, /profile-choice-model/);
  assert.match(css, /profile-select-cta/);
});

test("single-image processing uses a workspace HUD with progress pipeline and cancellation", () => {
  assert.match(html, /id="workspace-processing"/);
  assert.match(html, /id="progress-orb"/);
  assert.match(html, /data-processing-step="prepare"/);
  assert.match(html, /data-processing-step="reconstruct"/);
  assert.match(html, /data-processing-step="export"/);
  assert.match(html, /id="workspace-stop-button"/);
  assert.match(renderer, /function setWorkspaceProcessingVisible\(visible\)/);
  assert.match(renderer, /setWorkspaceProcessingVisible\(true\)/);
  assert.match(renderer, /setWorkspaceProcessingVisible\(false\)/);
});

test("v10 richer visuals remain free of expensive glass and permanent promotion", () => {
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /will-change/);
  assert.doesNotMatch(css, /filter:\s*blur/i);
  assert.doesNotMatch(css, /scroll-behavior:\s*smooth/i);
  assert.match(css, /conic-gradient\(var\(--accent-2\)/);
});
