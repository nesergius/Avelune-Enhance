"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const hashCache = new Map();
const inFlight = new Map();
const manifestCache = new Map();

function normalizeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^resources\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized === "..") {
    throw new Error(`Некорректный путь в манифесте целостности: ${normalized || "(пусто)"}.`);
  }
  if (!normalized.startsWith("models/") && !normalized.startsWith("win/bin/")) {
    throw new Error(`Недопустимый ресурс в манифесте целостности: ${normalized}.`);
  }
  return normalized;
}

function parseRuntimeManifest(raw, manifestPath) {
  let document;
  try { document = JSON.parse(raw); }
  catch (error) { throw new Error(`Манифест целостности повреждён: ${manifestPath}: ${error.message}`); }

  if (document?.schemaVersion !== 1 || document?.hashAlgorithm !== "SHA-256" || !Array.isArray(document.files)) {
    throw new Error(`Неподдерживаемый формат манифеста целостности: ${manifestPath}.`);
  }

  const manifest = Object.create(null);
  for (const record of document.files) {
    const relativePath = normalizeRelativePath(record?.path);
    const digest = String(record?.sha256 || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`Некорректный SHA-256 в манифесте целостности: ${relativePath}.`);
    }
    if (Object.hasOwn(manifest, relativePath)) {
      throw new Error(`Повторяющийся ресурс в манифесте целостности: ${relativePath}.`);
    }
    manifest[relativePath] = digest;
  }

  if (!Object.keys(manifest).length) {
    throw new Error(`Манифест целостности не содержит ресурсов: ${manifestPath}.`);
  }
  return manifest;
}

async function loadRuntimeManifest(resourcesRoot) {
  const manifestPath = path.join(resourcesRoot, "resource-manifest.json");
  let stat;
  try { stat = await fsp.stat(manifestPath); }
  catch { throw new Error("Манифест целостности приложения отсутствует. Переустановите Avelune Enhance."); }
  if (!stat.isFile()) throw new Error("Манифест целостности приложения повреждён.");

  const cacheKey = `${manifestPath}:${stat.size}:${stat.mtimeMs}`;
  if (manifestCache.has(cacheKey)) return manifestCache.get(cacheKey);
  const manifest = parseRuntimeManifest(await fsp.readFile(manifestPath, "utf8"), manifestPath);
  manifestCache.clear();
  manifestCache.set(cacheKey, manifest);
  return manifest;
}

async function sha256(filePath) {
  const stat = await fsp.stat(filePath);
  const key = `${filePath}:${stat.size}:${stat.mtimeMs}`;
  if (hashCache.has(key)) return hashCache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  }).then((digest) => {
    hashCache.set(key, digest);
    return digest;
  }).finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

async function verifyPackagedResource(resourcesRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const manifest = await loadRuntimeManifest(resourcesRoot);
  const expected = manifest[normalized];
  if (!expected) throw new Error(`Ресурс отсутствует в манифесте целостности: ${normalized}.`);
  const filePath = path.join(resourcesRoot, ...normalized.split("/"));
  let stat;
  try { stat = await fsp.stat(filePath); } catch { stat = null; }
  if (!stat?.isFile()) throw new Error(`Повреждён ресурс приложения: ${normalized} отсутствует.`);
  const actual = await sha256(filePath);
  if (actual !== expected) throw new Error(`Проверка целостности не пройдена: ${normalized}. Переустановите Avelune Enhance.`);
  return true;
}

async function verifyAllPackagedResources(resourcesRoot) {
  const manifest = await loadRuntimeManifest(resourcesRoot);
  const paths = Object.keys(manifest);
  await Promise.all(paths.map((relativePath) => verifyPackagedResource(resourcesRoot, relativePath)));
  return paths.length;
}

module.exports = {
  sha256,
  loadRuntimeManifest,
  parseRuntimeManifest,
  verifyPackagedResource,
  verifyAllPackagedResources,
};
