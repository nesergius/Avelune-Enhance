"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { validateBatchPayload } = require("../src/validators");

function payload(root, output, files) {
  return {
    requestId: crypto.randomUUID(),
    model: "avelune-standard-4x",
    saveImageAs: "png",
    scale: "2",
    useCustomWidth: false,
    customWidth: "",
    tileSize: 0,
    compression: 100,
    gpuId: "",
    ttaMode: false,
    overwrite: false,
    copyMetadata: true,
    preserveColorProfile: true,
    faceRecovery: false,
    faceRecoveryStrength: 0,
    batchFolderPath: root,
    outputPath: output,
    files
  };
}

test("selected batch files are accepted only inside the chosen root", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "avelune-batch-validation-"));
  try {
    const root = path.join(temp, "input");
    const output = path.join(temp, "output");
    const outside = path.join(temp, "outside.png");
    fs.mkdirSync(root); fs.mkdirSync(output);
    const inside = path.join(root, "inside.png");
    fs.writeFileSync(inside, Buffer.from([1]));
    fs.writeFileSync(outside, Buffer.from([1]));
    const valid = validateBatchPayload(payload(root, output, [inside]));
    assert.deepEqual(valid.files, [path.resolve(inside)]);
    assert.throws(() => validateBatchPayload(payload(root, output, [outside])), /вне исходной папки/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
