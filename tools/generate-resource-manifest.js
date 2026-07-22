#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const resourcesRoot = path.join(projectRoot, "resources");
const outputPath = path.join(resourcesRoot, "resource-manifest.json");

const roots = [
  { directory: path.join(resourcesRoot, "win", "bin"), role: "native-runtime" },
  { directory: path.join(resourcesRoot, "models"), role: "ai-model" },
];

function walk(directory) {
  const result = [];
  if (!fs.existsSync(directory)) {
    throw new Error(`Required resource directory is missing: ${directory}`);
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

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

const files = [];
for (const root of roots) {
  for (const filePath of walk(root.directory)) {
    const relativePath = path.relative(projectRoot, filePath).split(path.sep).join("/");
    const stat = fs.statSync(filePath);
    files.push({
      path: relativePath,
      role: root.role,
      bytes: stat.size,
      sha256: sha256(filePath),
    });
  }
}

files.sort((a, b) => a.path.localeCompare(b.path, "en"));

const manifest = {
  schemaVersion: 1,
  product: "Avelune Enhance",
  candidate: "2.0.0 RC4 preparation",
  hashAlgorithm: "SHA-256",
  deterministic: true,
  files,
};

fs.mkdirSync(resourcesRoot, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`[PASS] Resource manifest written: ${outputPath}`);
console.log(`[PASS] Recorded files: ${files.length}`);
