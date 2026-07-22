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
  assert.match(main, /initializeUpdater\(\{ app, logLine \}\)/);
});
