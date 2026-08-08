"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "renderer/out/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer/out/assets/app.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer/out/assets/app.js"), "utf8");

test("result quality defaults and built-in profiles use 100 percent", () => {
  assert.match(html, /id="quality-range"[^>]*value="100"/);
  assert.match(html, /id="batch-quality-range"[^>]*value="100"/);
  assert.match(renderer, /compression: 100/);
  assert.match(renderer, /batchCompression: 100/);
  const profiles = renderer.slice(renderer.indexOf("const PROFILE_CATALOG"), renderer.indexOf("const MODEL_CATALOG"));
  assert.equal((profiles.match(/compression: 100/g) || []).length, 11);
  assert.doesNotMatch(profiles, /compression: (?!100)\d+/);
});

test("history saving is disabled by default and migrated off once", () => {
  assert.match(html, /<input id="save-history-toggle" type="checkbox"\/>/);
  assert.doesNotMatch(html, /checked="" id="save-history-toggle"/);
  assert.match(renderer, /preferencesVersion: 4/);
  assert.match(renderer, /state\.saveHistory = false/);
});

test("collapsed sidebar always retains an accessible expand button", () => {
  assert.match(css, /body\.sidebar-compact \.sidebar-collapse \{[\s\S]*?display: grid;/);
  assert.match(css, /body\.sidebar-compact \.sidebar-collapse \{[\s\S]*?right: 0;/);
  assert.doesNotMatch(css, /body\.sidebar-compact \.brand-wrap \.sidebar-collapse/);
  assert.match(renderer, /Развернуть боковую панель/);
  assert.match(renderer, /els\.sidebarCollapse\?\.addEventListener/);
});

test("before and after comparison layers match their visible labels", () => {
  assert.match(html, /id="compare-frame"[\s\S]*id="after-image"\/>\s*<div class="before-clip"><img[^>]*id="before-image"/);
  assert.match(css, /\.before-clip \{[^}]*clip-path: inset\(0 calc\(100% - var\(--split\)\) 0 0\)/);
  assert.match(renderer, /els\.afterImage\.src = resultUrl;\s*els\.beforeImage\.src = job\.metadata\.sourcePreviewUrl/);
  assert.match(html, /before-tag">До<\/span><span class="compare-tag after-tag">После/);
});
