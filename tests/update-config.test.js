"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

test("Step 5 uses the official HTTPS generic update endpoint", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies["electron-updater"], "6.8.9");
  assert.match(packageJson.scripts["release:win"], /--publish never/);
  assert.equal(packageJson.build.publish[0].provider, "generic");
  assert.equal(packageJson.build.publish[0].url, "https://avelune.sayqq.ru/updates/");
  assert.equal(packageJson.build.publish[0].channel, "rc");
  assert.equal(packageJson.build.nsis.differentialPackage, true);
  assert.equal(packageJson.build.win.detectUpdateChannel, false);
});

test("Updater does not use setFeedURL and is gated for RC and Portable builds", () => {
  const updater = fs.readFileSync(path.join(ROOT, "src", "updater.js"), "utf8");
  const main = fs.readFileSync(path.join(ROOT, "src", "main.js"), "utf8");
  assert.doesNotMatch(updater, /setFeedURL/);
  assert.match(updater, /PORTABLE_EXECUTABLE_DIR/);
  assert.match(updater, /AVELUNE_ENABLE_RC_UPDATES/);
  assert.match(updater, /channel = prerelease \? "rc" : "latest"/);
  assert.match(main, /initializeUpdater\(\{\s*app\s*,\s*logLine\s*\}\)/);
});

test("tagged Windows builds publish downloadable release assets", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "build-windows-v2.yml"), "utf8");
  assert.match(workflow, /startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /Publish GitHub Release assets/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /gh release edit/);
  assert.match(workflow, /gh release upload/);
  assert.match(workflow, /--target \$env:GITHUB_SHA/);
  assert.match(workflow, /Avelune-Enhance-\.\+\-\(Setup\|Portable\)-x64/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /WIN_CSC_LINK/);
  assert.match(workflow, /WIN_CSC_KEY_PASSWORD/);
  assert.match(workflow, /Required Authenticode signature is not valid/);
  assert.match(workflow, /Scan Windows release files with Microsoft Defender/);
  assert.match(workflow, /RC6-DEFENDER-SCAN\.json/);
  assert.match(workflow, /contents: write/);
});
