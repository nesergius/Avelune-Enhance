"use strict";

const fs = require("fs");
const path = require("path");
const { BUILTIN_MODELS, IMAGE_EXTENSIONS, OUTPUT_FORMATS } = require("./constants");

const MAX_INPUT_BYTES = 1024 * 1024 * 1024;
const MAX_RESULT_PIXELS = 134_217_728;
const MAX_SIDE = 32_768;
const MAX_BATCH_FILES = 10_000;
const MAX_CLIPBOARD_BYTES = 64 * 1024 * 1024;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stringValue(value, name, maxLength = 4096) {
  assert(typeof value === "string", `${name}: ожидалась строка.`);
  const result = value.trim();
  assert(result.length > 0, `${name}: значение не указано.`);
  assert(result.length <= maxLength, `${name}: значение слишком длинное.`);
  assert(!result.includes("\0"), `${name}: недопустимый символ.`);
  return result;
}

function absolutePath(value, name) {
  const result = path.normalize(stringValue(value, name));
  assert(path.isAbsolute(result), `${name}: требуется абсолютный путь.`);
  return result;
}

function existingFile(value, name = "Файл") {
  const result = absolutePath(value, name);
  const stat = fs.statSync(result, { throwIfNoEntry: false });
  assert(stat && stat.isFile(), `${name}: файл не найден.`);
  assert(stat.size > 0, `${name}: файл пуст.`);
  assert(stat.size <= MAX_INPUT_BYTES, `${name}: файл превышает допустимый размер.`);
  return result;
}

function existingDirectory(value, name = "Папка") {
  const result = absolutePath(value, name);
  const stat = fs.statSync(result, { throwIfNoEntry: false });
  assert(stat && stat.isDirectory(), `${name}: папка не найдена.`);
  return result;
}

function ensureWritableDirectory(value, name = "Папка сохранения") {
  const result = existingDirectory(value, name);
  fs.accessSync(result, fs.constants.W_OK);
  return result;
}

function imagePath(value, name = "Изображение") {
  const result = existingFile(value, name);
  const ext = path.extname(result).slice(1).toLowerCase();
  assert(IMAGE_EXTENSIONS.includes(ext), `${name}: формат не поддерживается.`);
  return result;
}

function sanitizeBaseName(value) {
  const base = String(value || "image")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  return base || "image";
}

function safeModelId(value) {
  const result = stringValue(value, "AI-модель", 100);
  assert(/^[A-Za-z0-9._-]+$/.test(result), "AI-модель: недопустимое имя.");
  return result;
}

function outputFormat(value) {
  const result = stringValue(value, "Формат", 10).toLowerCase();
  assert(OUTPUT_FORMATS.includes(result), "Формат результата не поддерживается.");
  return result === "jpeg" ? "jpg" : result;
}

function integer(value, name, min, max) {
  const result = Number(value);
  assert(Number.isInteger(result), `${name}: требуется целое число.`);
  assert(result >= min && result <= max, `${name}: допустимый диапазон ${min}–${max}.`);
  return result;
}

function booleanValue(value) {
  return value === true;
}

function gpuId(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  const result = String(value).trim();
  assert(/^-?\d+(?:,\d+)*$/.test(result), "GPU ID имеет неверный формат.");
  return result;
}

function validateCommonPayload(payload) {
  assert(payload && typeof payload === "object" && !Array.isArray(payload), "Некорректные параметры задачи.");
  const useCustomWidth = booleanValue(payload.useCustomWidth);
  const scale = String(integer(Number(payload.scale), "Масштаб", 1, 4));
  const customWidth = useCustomWidth ? String(integer(Number(payload.customWidth), "Ширина", 64, MAX_SIDE)) : "";
  const tileRaw = Number(payload.tileSize || 0);
  const tileSize = tileRaw === 0 ? 0 : integer(tileRaw, "Размер тайла", 16, 4096);
  const compression = integer(Number(payload.compression), "Качество", 0, 100);
  return {
    model: safeModelId(payload.model),
    saveImageAs: outputFormat(payload.saveImageAs),
    scale,
    useCustomWidth,
    customWidth,
    tileSize,
    compression,
    gpuId: gpuId(payload.gpuId),
    ttaMode: booleanValue(payload.ttaMode),
    overwrite: booleanValue(payload.overwrite)
  };
}

function validateSinglePayload(payload) {
  const common = validateCommonPayload(payload);
  return {
    ...common,
    imagePath: imagePath(payload.imagePath),
    outputPath: ensureWritableDirectory(payload.outputPath)
  };
}

function validateBatchPayload(payload) {
  const common = validateCommonPayload(payload);
  return {
    ...common,
    batchFolderPath: existingDirectory(payload.batchFolderPath, "Исходная папка"),
    outputPath: ensureWritableDirectory(payload.outputPath)
  };
}

function validateClipboardPayload(payload) {
  assert(payload && typeof payload === "object", "Некорректные данные буфера обмена.");
  const encodedBuffer = stringValue(payload.encodedBuffer, "Данные изображения", MAX_CLIPBOARD_BYTES * 2);
  assert(/^[A-Za-z0-9+/=\r\n]+$/.test(encodedBuffer), "Буфер обмена содержит некорректные данные.");
  const buffer = Buffer.from(encodedBuffer, "base64");
  assert(buffer.length > 0 && buffer.length <= MAX_CLIPBOARD_BYTES, "Изображение из буфера слишком большое.");
  const extension = outputFormat(payload.extension || "png");
  const outputPath = payload.path ? ensureWritableDirectory(payload.path) : null;
  return { buffer, extension, outputPath };
}

function validateTargetDimensions(width, height, payload) {
  assert(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0, "Не удалось определить размер изображения.");
  let targetWidth;
  let targetHeight;
  if (payload.useCustomWidth) {
    targetWidth = Number(payload.customWidth);
    targetHeight = Math.max(1, Math.round(height * (targetWidth / width)));
  } else {
    const scale = Number(payload.scale);
    targetWidth = width * scale;
    targetHeight = height * scale;
  }
  assert(targetWidth <= MAX_SIDE && targetHeight <= MAX_SIDE, `Результат превышает ${MAX_SIDE}px по стороне.`);
  assert(targetWidth * targetHeight <= MAX_RESULT_PIXELS, "Результат превышает безопасный лимит мегапикселей.");
  return { targetWidth, targetHeight };
}

function modelFilesExist(modelsPath, model) {
  const bin = path.join(modelsPath, `${model}.bin`);
  const param = path.join(modelsPath, `${model}.param`);
  return fs.existsSync(bin) && fs.existsSync(param);
}

function listImageFiles(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.includes(path.extname(entry.name).slice(1).toLowerCase()))
    .map((entry) => path.join(directory, entry.name));
  assert(files.length > 0, "В выбранной папке нет поддерживаемых изображений.");
  assert(files.length <= MAX_BATCH_FILES, `В одной задаче поддерживается не более ${MAX_BATCH_FILES} файлов.`);
  return files;
}

module.exports = {
  MAX_SIDE,
  MAX_RESULT_PIXELS,
  assert,
  absolutePath,
  existingFile,
  existingDirectory,
  ensureWritableDirectory,
  imagePath,
  sanitizeBaseName,
  safeModelId,
  outputFormat,
  validateSinglePayload,
  validateBatchPayload,
  validateClipboardPayload,
  validateTargetDimensions,
  modelFilesExist,
  listImageFiles,
  BUILTIN_MODELS
};
