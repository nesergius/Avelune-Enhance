"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(
  path.join(root, "renderer", "out", "index.html"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.css"),
  "utf8"
);
const renderer = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.js"),
  "utf8"
);

test("before/after divider includes a visible vertical line", () => {
  assert.match(css, /\.compare-divider::before\s*\{/);
  assert.match(css, /width:\s*2px/);
  assert.match(css, /linear-gradient\(/);
});

test("comparison uses exact pointer coordinates rather than one-percent native steps", () => {
  assert.match(html, /id="compare-range"[^>]*step="0\.01"/);
  assert.match(html, /id="compare-frame"/);
  assert.match(renderer, /function setCompareSplitFromClientX\(clientX\)/);
  assert.match(renderer, /getBoundingClientRect\(\)/);
  assert.match(renderer, /setPointerCapture\(event\.pointerId\)/);
  assert.match(renderer, /const rect = \(els\.compareFrame \|\| els\.compareCanvas\)\.getBoundingClientRect\(\)/);
  assert.match(renderer, /setCompareSplit\(\(\(clientX - rect\.left\) \/ rect\.width\) \* 100\)/);
});

test("comparison frame keeps before and after images in one adaptive aspect box", () => {
  assert.match(css, /\.compare-frame\s*\{[^}]*position:\s*relative[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.compare-image\s*\{[^}]*position:\s*absolute[^}]*object-fit:\s*cover/s);
  assert.match(renderer, /function syncCompareFrame\(\)/);
  assert.match(renderer, /getImageAspect\(els\.beforeImage\) \|\| getImageAspect\(els\.afterImage\)/);
  assert.match(renderer, /new ResizeObserver\(syncCompareFrame\)/);
  assert.match(renderer, /requestAnimationFrame\(syncCompareFrame\)/);
});

test("comparison surface supports keyboard precision and has no visual transition queue", () => {
  assert.match(html, /id="compare-canvas"[^>]*role="slider"/);
  assert.match(renderer, /event\.key === "ArrowLeft"/);
  assert.match(renderer, /event\.key === "ArrowRight"/);
  assert.match(css, /\.compare-divider\s*\{[\s\S]*?transition:\s*none\s*!important/);
  assert.match(css, /\.before-clip\s*\{[\s\S]*?transition:\s*none\s*!important/);
});
