"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");
const html = fs.readFileSync(path.join(root, "renderer", "out", "index.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer", "out", "assets", "app.js"), "utf8");

test("Electron security settings are enabled", () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
});

test("preload exposes only whitelisted IPC channels", () => {
  assert.match(preload, /Blocked IPC channel/);
  assert.doesNotMatch(preload, /ipcRenderer\.send\(channel/);
});

test("renderer has strict CSP and no smooth scrolling", () => {
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /unsafe-eval/);
  const css = fs.readFileSync(path.join(root, "renderer", "out", "assets", "app.css"), "utf8");
  assert.doesNotMatch(css, /scroll-behavior:\s*smooth/i);
});

test("user-facing renderer does not mention the previous product brand or model weights", () => {
  assert.doesNotMatch(renderer, /Upscayl/i);
  assert.doesNotMatch(renderer, /лицензи[яю]\s+вес/i);
  assert.doesNotMatch(renderer, /происхождение\s+вес/i);
});


test("packaged native engine contains no previous product brand strings", () => {
  const engine = fs.readFileSync(path.join(root, "resources", "win", "bin", "avelune-engine.exe"));
  assert.equal(engine.toString("latin1").toLowerCase().includes("upscayl"), false);
});

test("RC4 includes a DXGI VRAM helper and verifies its integrity", () => {
  assert.match(main, /avelune-gpu-info\.exe/);
  assert.match(main, /verifyPackagedResource/);
  assert.ok(fs.existsSync(path.join(root, "resources", "win", "bin", "avelune-gpu-info.exe")));
});


test("RC4 main process imports integrity verification and exposes a runtime probe", () => {
  assert.match(main, /const \{ verifyPackagedResource \} = require\("\.\/integrity"\)/);
  assert.match(main, /--avelune-runtime-probe=/);
  assert.match(main, /electron: process\.versions\.electron/);
  assert.match(main, /APP_DISPLAY_VERSION = "2\.0\.0 RC4"/);
});

test("RC4 renderer and package metadata expose the same release candidate", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(html, /v2\.0\.0 RC4/);
  assert.equal(pkg.version, "2.0.0-rc.4");
  assert.equal(pkg.buildVersion, "2.0.0.4");
  assert.equal(pkg.devDependencies.electron, "43.1.1");
});
