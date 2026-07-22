"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const manifest = require("./resource-integrity.json");
const cache = new Map();

function sha256(filePath) {
  const stat = fs.statSync(filePath);
  const key = `${filePath}:${stat.size}:${stat.mtimeMs}`;
  if (cache.has(key)) return cache.get(key);
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(fd);
  }
  const result = hash.digest("hex");
  cache.clear();
  cache.set(key, result);
  return result;
}

function verifyPackagedResource(resourcesRoot, relativePath) {
  const expected = manifest[relativePath.replace(/\\/g, "/")];
  if (!expected) return false;
  const filePath = path.join(resourcesRoot, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Повреждён ресурс приложения: ${relativePath} отсутствует.`);
  const actual = sha256(filePath);
  if (actual !== expected) throw new Error(`Проверка целостности не пройдена: ${relativePath}. Переустановите Avelune Enhance.`);
  return true;
}

module.exports = { sha256, verifyPackagedResource };
