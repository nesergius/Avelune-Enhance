"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "renderer/out/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer/out/assets/app.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer/out/assets/app.js"), "utf8");

test("UI v9 uses a navigation rail, focused controls and a fixed workspace", () => {
  assert.match(html, /data-ui="studio-rail-v9"/);
  assert.match(css, /--rail-width: 68px/);
  assert.match(css, /--controls-width: 312px/);
  assert.match(css, /grid-template-columns: var\(--rail-width\) var\(--controls-width\)/);
  assert.match(css, /\.preview-card \{[\s\S]*?contain: layout paint/);
});

test("the live GPU indicator is displayed in the enhance workspace toolbar", () => {
  assert.match(html, /workspace-toolbar[\s\S]*id="hardware-chip"[\s\S]*panel-heading-actions/);
});

test("comparison pointer updates are limited to animation frames", () => {
  assert.match(renderer, /function scheduleCompareSplit\(clientX\)/);
  assert.match(renderer, /requestAnimationFrame\(\(\) =>/);
  assert.match(renderer, /scheduleCompareSplit\(event\.clientX\)/);
});

test("large surfaces avoid expensive blur and permanent compositor promotion", () => {
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /will-change/);
  assert.doesNotMatch(css, /scroll-behavior:\s*smooth/i);
});
