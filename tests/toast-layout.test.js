"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.css"),
  "utf8"
);
const renderer = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.js"),
  "utf8"
);

test("toast layout reserves separate title message and close columns", () => {
  assert.match(css, /\.toast \{[^}]*grid-template-columns: 34px minmax\(0,1fr\) 28px/);
  assert.match(css, /\.toast > div \{[^}]*display: grid/);
  assert.match(css, /\.toast small \{[^}]*line-height: 1\.35/);
  assert.match(css, /body\[data-active-view="enhance"\] \.toast-stack \{[\s\S]*?top: 62px;/);
  assert.match(css, /body\[data-active-view="enhance"\] \.toast-stack \{[\s\S]*?width: min\(330px, calc\(100vw - 40px\)\);/);
  assert.match(renderer, /<strong>\$\{escapeHtml\(trUi\(title\)\)\}<\/strong><small>\$\{escapeHtml\(trUi\(message\)\)\}<\/small>/);
});
