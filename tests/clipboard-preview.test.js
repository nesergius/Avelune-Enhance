"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const constants = fs.readFileSync(path.join(root, "src", "constants.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");
const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const renderer = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.js"),
  "utf8"
);

test("clipboard preview keeps each object URL correlated with its save request", () => {
  assert.match(renderer, /const pendingClipboardPreviews = new Map\(\)/);
  assert.match(renderer, /function createRequestId\(\)/);
  assert.match(renderer, /crypto\.getRandomValues\(bytes\)/);
  assert.match(renderer, /const requestId = createRequestId\(\)/);
  assert.match(renderer, /latestClipboardRequestId = requestId/);
  assert.match(renderer, /storePendingClipboardPreview\(requestId, URL\.createObjectURL\(file\)\)/);
  assert.match(renderer, /const previewUrl = takePendingClipboardPreview\(requestId\)/);
  assert.match(renderer, /requestId !== latestClipboardRequestId/);
  assert.match(renderer, /setSourceImage\(path, \{ previewUrl \}\)/);
  assert.match(renderer, /replaceActiveSourceObjectUrl\(preferredUrl\)/);
  assert.match(renderer, /URL\.revokeObjectURL\(url\)/);
});

test("clipboard IPC success and errors preserve the request identifier", () => {
  assert.match(main, /jobId\(raw\?\.requestId\)/);
  assert.match(main, /PASTE_IMAGE_SAVE_SUCCESS, \{ requestId: payload\.requestId, path: target \}/);
  assert.match(main, /PASTE_IMAGE_SAVE_ERROR, \{ requestId, error: cleanError\(error\) \}/);
});

test("file preview has a validated binary fallback through a whitelisted IPC method", () => {
  assert.match(constants, /GET_IMAGE_PREVIEW: "avelune:get-image-preview"/);
  assert.match(preload, /getImagePreview\(filePath\)/);
  assert.match(main, /ipcMain\.handle\(CHANNELS\.GET_IMAGE_PREVIEW/);
  assert.match(main, /imagePath\(rawPath, "Изображение предпросмотра"\)/);
  assert.match(main, /MAX_PREVIEW_FALLBACK_BYTES/);
  assert.match(renderer, /createFallbackPreviewUrl\(path\)/);
  assert.match(renderer, /new Blob\(\[bytes\]/);
});

test("packaged UI probe executes the real clipboard save and visible-preview path", () => {
  assert.match(main, /const clipboardFile = new File/);
  assert.match(main, /document\.dispatchEvent\(pasteEvent\)/);
  assert.match(main, /image\?\.naturalWidth === 1/);
  assert.match(main, /image\?\.naturalHeight === 1/);
  assert.match(main, /image\?\.complete === true/);
  assert.match(main, /\^blob:\/i\.test\(source\)/);
  assert.match(main, /clipboardObservedDuringWait \|\| \(/);
  assert.match(main, /clipboardDebug\.naturalWidth === 1/);
  assert.match(main, /clipboardDebug\.naturalHeight === 1/);
  assert.match(main, /clipboardDebug\.srcScheme === 'blob'/);
  assert.doesNotMatch(main, /resolution\.match/);
  assert.doesNotMatch(main, /1\s\*×\s\*1/);
  assert.match(main, /clipboardPreviewPassed/);
  assert.match(main, /await fsp\.rm\(clipboardPreviewPath/);
});
