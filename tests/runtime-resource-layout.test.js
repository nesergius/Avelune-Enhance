"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resourcePaths } = require("../src/engine");
const { verifyAllPackagedResources } = require("../src/integrity");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const integrity = JSON.parse(fs.readFileSync(path.join(root, "src", "resource-integrity.json"), "utf8"));

test("native runtime source, package destination and runtime lookup use the same win/bin layout", () => {
  const native = pkg.build.extraResources.find((entry) => entry.from === "resources/win/bin");
  assert.deepEqual(native, { from: "resources/win/bin", to: "win/bin" });
  const fakeApp = { getAppPath: () => root };
  const development = resourcePaths(fakeApp, false);
  assert.equal(development.engine, path.join(root, "resources", "win", "bin", "avelune-engine.exe"));
  assert.equal(development.gpuInfo, path.join(root, "resources", "win", "bin", "avelune-gpu-info.exe"));
  assert.ok(Object.hasOwn(integrity, "win/bin/avelune-engine.exe"));
  assert.ok(Object.hasOwn(integrity, "win/bin/avelune-gpu-info.exe"));
});

test("the complete runtime integrity preflight succeeds against the source layout used for packaging", async () => {
  const count = await verifyAllPackagedResources(path.join(root, "resources"));
  assert.equal(count, Object.keys(integrity).length);
});
