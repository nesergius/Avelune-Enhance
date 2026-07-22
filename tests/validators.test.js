"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  sanitizeBaseName,
  outputFormat,
  validateTargetDimensions,
  validateClipboardPayload,
  safeModelId
} = require("../src/validators");

test("sanitizes Windows-invalid output characters", () => {
  assert.equal(sanitizeBaseName('a<b>:c"d/e\\f|g?h*.'), "a_b__c_d_e_f_g_h_");
});

test("normalizes jpeg to jpg", () => {
  assert.equal(outputFormat("jpeg"), "jpg");
});

test("rejects unsafe model ids", () => {
  assert.throws(() => safeModelId("../model"), /недопустимое/);
});

test("calculates safe target dimensions", () => {
  assert.deepEqual(validateTargetDimensions(100, 50, { useCustomWidth: false, scale: "4" }), { targetWidth: 400, targetHeight: 200 });
  assert.deepEqual(validateTargetDimensions(100, 50, { useCustomWidth: true, customWidth: "1000" }), { targetWidth: 1000, targetHeight: 500 });
});

test("rejects excessive output dimensions", () => {
  assert.throws(() => validateTargetDimensions(20000, 20000, { useCustomWidth: false, scale: "4" }), /превышает/);
});

test("clipboard ignores attacker-controlled file name and validates base64", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avelune-test-"));
  const parsed = validateClipboardPayload({ path: dir, name: "../../bad.png", extension: "png", encodedBuffer: Buffer.from("abc").toString("base64") });
  assert.equal(parsed.outputPath, dir);
  assert.equal(parsed.extension, "png");
  assert.equal(parsed.buffer.toString(), "abc");
  fs.rmSync(dir, { recursive: true, force: true });
});
