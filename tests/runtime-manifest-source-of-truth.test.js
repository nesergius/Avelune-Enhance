"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseRuntimeManifest, loadRuntimeManifest, verifyPackagedResource } = require("../src/integrity");

function digest(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

test("packaged runtime integrity uses resource-manifest.json as its source of truth", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "avelune-runtime-manifest-"));
  const modelDir = path.join(root, "models");
  fs.mkdirSync(modelDir, { recursive: true });
  const bytes = Buffer.from("official-model-test");
  fs.writeFileSync(path.join(modelDir, "realesrnet-x4plus.bin"), bytes);
  fs.writeFileSync(path.join(root, "resource-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    hashAlgorithm: "SHA-256",
    files: [{ path: "resources/models/realesrnet-x4plus.bin", sha256: digest(bytes), bytes: bytes.length }],
  }));
  try {
    const manifest = await loadRuntimeManifest(root);
    assert.equal(manifest["models/realesrnet-x4plus.bin"], digest(bytes));
    await assert.doesNotReject(() => verifyPackagedResource(root, "models/realesrnet-x4plus.bin"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("runtime manifest parser rejects traversal and duplicate records", () => {
  assert.throws(() => parseRuntimeManifest(JSON.stringify({ schemaVersion: 1, hashAlgorithm: "SHA-256", files: [{ path: "resources/../evil.bin", sha256: "0".repeat(64) }] }), "test.json"), /Некорректный путь|Недопустимый ресурс/);
  assert.throws(() => parseRuntimeManifest(JSON.stringify({ schemaVersion: 1, hashAlgorithm: "SHA-256", files: [
    { path: "resources/models/a.bin", sha256: "0".repeat(64) },
    { path: "models/a.bin", sha256: "1".repeat(64) },
  ] }), "test.json"), /Повторяющийся ресурс/);
});

test("resource generator synchronizes the packaged manifest and source audit mirror", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tools", "generate-resource-manifest.js"), "utf8");
  const verifier = fs.readFileSync(path.join(__dirname, "..", "tools", "verify-resource-manifest.js"), "utf8");
  assert.match(source, /runtimeMirrorPath/);
  assert.match(source, /Runtime integrity mirror written/);
  assert.match(verifier, /does not match resources\/resource-manifest\.json/);
});
