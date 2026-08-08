"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");
const renderer = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.js"),
  "utf8"
);
const stager = fs.readFileSync(
  path.join(root, "tools", "stage-source-snapshot.js"),
  "utf8"
);

test("drag-and-drop uses Electron webUtils instead of removed File.path", () => {
  assert.match(preload, /contextBridge, ipcRenderer, webUtils/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
  assert.match(renderer, /electron\?\.getPathForFile\?\.\(file\)/);
  assert.doesNotMatch(renderer, /file\?\.path|file\.path/);
});

test("drag-and-drop validates the visible filename before resolving its native path", () => {
  assert.match(renderer, /const fileName = String\(file\?\.name \|\| ""\)/);
  assert.match(renderer, /\\\.\(png\|jpe\?g\|jfif\|webp\)/);
  assert.match(renderer, /setSourceImage\(nativePath\)/);
});

test("source snapshot removes generated outputs and patch backup directories", () => {
  assert.match(stager, /endsWith\("-output"\)/);
  assert.match(stager, /\^\\.rc\.\*-backup-/);
  assert.match(stager, /startsWith\("\.qa-"\)/);
  assert.match(stager, /startsWith\("qa-report-"\)/);
  assert.match(stager, /fs\.promises\.rm\(destinationRoot/);
});
