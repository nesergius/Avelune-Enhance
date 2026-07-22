#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const [inputArg, patchArg, outputArg] = process.argv.slice(2);
if (!inputArg || !patchArg || !outputArg) {
  console.error("Usage: node tools/apply-engine-binary-patch.js <official.exe> <patch.json> <output.exe>");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const patchPath = path.resolve(patchArg);
const outputPath = path.resolve(outputArg);
const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
const data = fs.readFileSync(inputPath);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

if (sha256(data).toLowerCase() !== patch.baseSha256.toLowerCase()) {
  throw new Error("Base executable SHA-256 does not match the patch.");
}
if (data.length !== patch.baseBytes) {
  throw new Error("Base executable size does not match the patch.");
}

for (const range of patch.ranges) {
  const before = Buffer.from(range.beforeBase64, "base64");
  const after = Buffer.from(range.afterBase64, "base64");
  if (before.length !== after.length || before.length !== range.length) {
    throw new Error(`Invalid patch range at offset ${range.offset}.`);
  }
  const actualBefore = data.subarray(range.offset, range.offset + range.length);
  if (!actualBefore.equals(before)) {
    throw new Error(`Base bytes do not match at offset ${range.offset}.`);
  }
  after.copy(data, range.offset);
}

const resultHash = sha256(data);
if (resultHash.toLowerCase() !== patch.targetSha256.toLowerCase()) {
  throw new Error(`Patched SHA-256 mismatch: ${resultHash}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, data);
console.log(`[PASS] Reproduced target executable: ${outputPath}`);
console.log(`[PASS] SHA-256: ${resultHash}`);
