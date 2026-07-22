#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "resources", "resource-manifest.json");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function walk(directory) {
  const result = [];
  if (!fs.existsSync(directory)) {
    return result;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest is missing: ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`Manifest is invalid JSON: ${error.message}`);
  process.exit(1);
}

if (manifest.schemaVersion !== 1 || manifest.hashAlgorithm !== "SHA-256") {
  fail("Unsupported resource manifest schema or hash algorithm.");
}

if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  fail("Manifest does not contain resource files.");
  process.exit(1);
}

const listedPaths = new Set();
for (const record of manifest.files) {
  if (!record || typeof record.path !== "string" || typeof record.sha256 !== "string") {
    fail("Manifest contains an invalid file record.");
    continue;
  }

  const normalized = record.path.replaceAll("\\", "/");
  if (listedPaths.has(normalized)) {
    fail(`Duplicate manifest path: ${normalized}`);
    continue;
  }
  listedPaths.add(normalized);

  const fullPath = path.join(projectRoot, ...normalized.split("/"));
  if (!fs.existsSync(fullPath)) {
    fail(`Listed resource is missing: ${normalized}`);
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    fail(`Listed resource is not a file: ${normalized}`);
    continue;
  }
  if (stat.size !== record.bytes) {
    fail(`Size mismatch: ${normalized}`);
  }

  const actualHash = sha256(fullPath);
  if (actualHash.toLowerCase() !== record.sha256.toLowerCase()) {
    fail(`SHA-256 mismatch: ${normalized}`);
  }
}

const actualFiles = [
  ...walk(path.join(projectRoot, "resources", "win", "bin")),
  ...walk(path.join(projectRoot, "resources", "models")),
].map((filePath) => path.relative(projectRoot, filePath).split(path.sep).join("/"));

for (const actualPath of actualFiles) {
  if (!listedPaths.has(actualPath)) {
    fail(`Unlisted resource file: ${actualPath}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`[PASS] Resource manifest verified: ${manifest.files.length} file(s).`);
