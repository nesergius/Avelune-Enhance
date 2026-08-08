"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { getImageInfo } = require("./image-info");
const { verifyPackagedResource } = require("./integrity");
const { sanitizeBaseName, validateTargetDimensions, modelFilesExist, listImageFiles } = require("./validators");
const { preserveImageMetadata } = require("./metadata");

const DEFAULT_ENGINE_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function sanitizeEngineDiagnostic(value) {
  return String(value || "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/upscayl(?:ed)?/gi, "Avelune")
    .replace(/^[ЁЯЩМРЎЃ]{2,8}\s+(?=Avelune)/, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u0400-\u04ff]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim().slice(0, 4000);
}

function progressFromEngineChunk(chunk) {
  const ascii = Buffer.isBuffer(chunk) ? chunk.toString("latin1") : String(chunk || "");
  const lines = ascii.replace(/\r/g, "\n").split("\n").map((line) => line.replace(/[^\x20-\x7e]/g, "").trim()).filter(Boolean);
  const safe = [];
  for (const line of lines) {
    const percent = line.match(/(?:^|\s)(\d{1,3}(?:[.,]\d+)?)\s*%/);
    if (percent) {
      const normalized = Math.max(0, Math.min(100, Number(percent[1].replace(",", "."))));
      if (Number.isFinite(normalized)) safe.push(`${normalized.toFixed(normalized % 1 ? 1 : 0)}%\n`);
      continue;
    }
    if (/resiz|convert|tile|load|model/i.test(line)) safe.push(`${sanitizeEngineDiagnostic(line)}\n`);
  }
  return safe;
}

function modelNativeScale(model) {
  const lower = String(model).toLowerCase();
  if (lower.includes("x2") || lower.includes("2x")) return 2;
  if (lower.includes("x3") || lower.includes("3x")) return 3;
  return 4;
}

function resourcePaths(app, isPackaged) {
  const root = isPackaged ? process.resourcesPath : path.join(app.getAppPath(), "resources");
  return { root, engine: path.join(root, "win", "bin", "avelune-engine.exe"), gpuInfo: path.join(root, "win", "bin", "avelune-gpu-info.exe"), models: path.join(root, "models") };
}

function buildArgs({ input, output, modelsPath, model, payload, forceWidth }) {
  const args = ["-i", input, "-o", output, "-m", modelsPath, "-n", model];
  const nativeScale = modelNativeScale(model);
  if (forceWidth) args.push("-w", String(forceWidth));
  else if (payload.useCustomWidth) args.push("-w", String(payload.customWidth));
  else if (Number(payload.scale) !== nativeScale) args.push("-s", String(payload.scale));
  if (payload.gpuId) args.push("-g", payload.gpuId);
  args.push("-f", payload.saveImageAs, "-c", String(payload.compression));
  if (payload.tileSize) args.push("-t", String(payload.tileSize));
  if (payload.ttaMode) args.push("-x");
  return args;
}

function terminateProcessTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch { try { child.kill(); } catch {} }
}

function runEngine({ enginePath, args, signal, onProgress, timeoutMs = DEFAULT_ENGINE_TIMEOUT_MS, inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    let settled = false, stderr = "", stdout = "", absoluteTimer = null, inactivityTimer = null;
    const child = spawn(enginePath, args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });

    const clearTimers = () => { if (absoluteTimer) clearTimeout(absoluteTimer); if (inactivityTimer) clearTimeout(inactivityTimer); };
    const releaseChildHandles = () => {
      try { child.stdout?.destroy(); } catch {}
      try { child.stderr?.destroy(); } catch {}
      try { child.unref?.(); } catch {}
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimers();
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const failWatchdog = (message) => {
      terminateProcessTree(child);
      releaseChildHandles();
      finish(() => reject(new Error(message)));
    };
    const resetInactivity = () => {
      if (!Number.isFinite(inactivityTimeoutMs) || inactivityTimeoutMs <= 0) return;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => failWatchdog("AI-движок перестал отвечать. Процесс остановлен по таймеру бездействия."), inactivityTimeoutMs);
      inactivityTimer.unref?.();
    };
    const consume = (chunk, target) => {
      resetInactivity();
      const raw = chunk.toString("latin1");
      if (target === "stderr") stderr = (stderr + raw).slice(-32_000); else stdout = (stdout + raw).slice(-32_000);
      if (onProgress) for (const update of progressFromEngineChunk(chunk)) onProgress(update);
    };
    const onAbort = () => {
      terminateProcessTree(child);
      releaseChildHandles();
      finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Задача отменена.")));
    };

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      absoluteTimer = setTimeout(() => failWatchdog("Превышено максимальное время обработки. AI-движок остановлен."), timeoutMs);
      absoluteTimer.unref?.();
    }
    resetInactivity();
    child.stdout.on("data", (chunk) => consume(chunk, "stdout"));
    child.stderr.on("data", (chunk) => consume(chunk, "stderr"));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, closeSignal) => finish(() => {
      if (code === 0) {
        onProgress?.("Avelune: обработка успешно завершена.\n");
        return resolve({ code, stdout: sanitizeEngineDiagnostic(stdout), stderr: sanitizeEngineDiagnostic(stderr) });
      }
      const detail = sanitizeEngineDiagnostic(stderr || stdout || `код ${code}${closeSignal ? `, сигнал ${closeSignal}` : ""}`);
      reject(new Error(`AI-движок завершился с ошибкой: ${detail || `код ${code}`}`));
    }));
  });
}


function isLikelyGpuMemoryError(error) {
  return /(?:out of memory|memory allocation|vk_error_out_of_device_memory|failed to allocate|invalid tile size|device lost)/i.test(String(error?.message || error || ""));
}

async function runEngineWithTileFallback({ enginePath, makeArgs, outputPath, signal, onProgress, initialTileSize = 0 }) {
  const candidates = [initialTileSize, 256, 128, 64].filter((value, index, all) => Number(value) >= 0 && all.indexOf(value) === index);
  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const tileSize = candidates[index];
    fs.rmSync(outputPath, { force: true });
    try {
      if (index > 0) onProgress?.(`GPU memory recovery: retry with tile ${tileSize}px\n`);
      return await runEngine({ enginePath, args: makeArgs(tileSize), signal, onProgress });
    } catch (error) {
      lastError = error;
      if (signal?.aborted || !isLikelyGpuMemoryError(error) || index === candidates.length - 1) throw error;
    }
  }
  throw lastError || new Error("Не удалось выполнить обработку.");
}


function mapStageProgress(onProgress, startPercent, endPercent, stageLabel) {
  return (text) => {
    const value = String(text || "");
    const match = value.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
    if (match) {
      const nativePercent = Math.max(0, Math.min(100, Number(match[1].replace(",", "."))));
      const mapped = Math.round(startPercent + ((endPercent - startPercent) * nativePercent / 100));
      onProgress?.(`${mapped}%\n`);
      return;
    }
    const diagnostic = sanitizeEngineDiagnostic(value);
    if (diagnostic) onProgress?.(`${stageLabel}: ${diagnostic}\n`);
  };
}

function preserveMetadataSafely(sourcePath, outputPath, payload, onProgress) {
  try {
    const changed = preserveImageMetadata(sourcePath, outputPath, payload);
    if (changed) onProgress?.("Metadata and color profile preserved\n");
    return changed;
  } catch (error) {
    onProgress?.(`Metadata warning: ${sanitizeEngineDiagnostic(error?.message || error)}\n`);
    return false;
  }
}

function verifyOutput(filePath) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.size < 32) throw new Error("AI-движок не создал корректный файл результата.");
  return getImageInfo(filePath);
}

function publishAtomic(tempPath, finalPath, overwrite) {
  verifyOutput(tempPath);
  if (!fs.existsSync(finalPath)) { fs.renameSync(tempPath, finalPath); return finalPath; }
  if (!overwrite) {
    const availablePath = availableOutputPath(finalPath, false);
    fs.renameSync(tempPath, availablePath);
    verifyOutput(availablePath);
    return availablePath;
  }

  const backupPath = `${finalPath}.avelune-backup-${crypto.randomUUID()}`;
  fs.renameSync(finalPath, backupPath);
  try {
    fs.renameSync(tempPath, finalPath);
    verifyOutput(finalPath);
    fs.rmSync(backupPath, { force: true });
    return finalPath;
  } catch (error) {
    fs.rmSync(finalPath, { force: true });
    if (fs.existsSync(backupPath)) fs.renameSync(backupPath, finalPath);
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}

function makeTempPath(outputDirectory, format) { return path.join(outputDirectory, `.avelune-${crypto.randomUUID()}.${format}`); }
function outputName(inputPath, payload) {
  const base = sanitizeBaseName(path.parse(inputPath).name);
  const dimension = payload.useCustomWidth ? `${payload.customWidth}px` : `${payload.scale}x`;
  return `${base}_avelune_${dimension}_${payload.model}.${payload.saveImageAs}`;
}
function availableOutputPath(desiredPath, overwrite = false) {
  if (overwrite || !fs.existsSync(desiredPath)) return desiredPath;
  const parsed = path.parse(desiredPath);
  for (let index = 2; index <= 9999; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Не удалось подобрать свободное имя файла результата.");
}

async function assertResources(resources, modelsPath, model) {
  if (!fs.existsSync(resources.engine)) throw new Error("Не найден исполняемый файл AI-движка.");
  await verifyPackagedResource(resources.root, path.join("win", "bin", "avelune-engine.exe"));
  if (!modelFilesExist(modelsPath, model)) throw new Error(`Файлы AI-модели «${model}» не найдены.`);
  if (path.resolve(modelsPath) === path.resolve(resources.models)) {
    await Promise.all([
      verifyPackagedResource(resources.root, path.join("models", `${model}.bin`)),
      verifyPackagedResource(resources.root, path.join("models", `${model}.param`))
    ]);
  }
}

async function processSingle({ app, isPackaged, payload, customModelsPath, signal, onProgress, doublePass = false }) {
  const resources = resourcePaths(app, isPackaged);
  const modelsPath = modelFilesExist(resources.models, payload.model) ? resources.models : customModelsPath;
  if (!modelsPath) throw new Error("Папка пользовательской AI-модели не выбрана.");
  await assertResources(resources, modelsPath, payload.model);
  const neuralRestore = Boolean(payload.neuralRestore && Number(payload.neuralRestoreStrength) >= 20);
  if (neuralRestore) {
    await assertResources(resources, resources.models, "realesrnet-x4plus");
    await assertResources(resources, resources.models, "avelune-standard-4x");
  }
  const sourceInfo = getImageInfo(payload.imagePath);
  const target = validateTargetDimensions(sourceInfo.width, sourceInfo.height, payload);
  const desiredPath = path.join(payload.outputPath, outputName(payload.imagePath, payload));
  const finalPath = availableOutputPath(desiredPath, payload.overwrite);

  const tempFirst = makeTempPath(payload.outputPath, payload.saveImageAs);
  const needsRefinement = Boolean(doublePass || neuralRestore);
  const tempSecond = needsRefinement ? makeTempPath(payload.outputPath, payload.saveImageAs) : null;
  try {
    if (neuralRestore) {
      const strength = Math.max(20, Math.min(100, Number(payload.neuralRestoreStrength) || 70));
      const intermediateWidth = Math.max(64, Math.min(target.targetWidth, Math.round(sourceInfo.width * 2)));
      onProgress?.(`1%\n`);
      onProgress?.(`Нейровосстановление 1/2: очистка структуры и компрессионных артефактов (${strength}%)\n`);
      await runEngineWithTileFallback({
        enginePath: resources.engine,
        outputPath: tempFirst,
        signal,
        onProgress: mapStageProgress(onProgress, 2, 42, "Очистка структуры"),
        initialTileSize: Number(payload.tileSize) || 0,
        makeArgs: (tileSize) => buildArgs({
          input: payload.imagePath,
          output: tempFirst,
          modelsPath: resources.models,
          model: "realesrnet-x4plus",
          payload: { ...payload, tileSize, scale: "2", useCustomWidth: false, ttaMode: strength >= 90 },
          forceWidth: intermediateWidth
        })
      });
      verifyOutput(tempFirst);
      onProgress?.(`43%\n`);
      onProgress?.("Нейровосстановление 2/2: генеративная реконструкция деталей\n");
      await runEngineWithTileFallback({
        enginePath: resources.engine,
        outputPath: tempSecond,
        signal,
        onProgress: mapStageProgress(onProgress, 44, 99, "Реконструкция деталей"),
        initialTileSize: Number(payload.tileSize) || 0,
        makeArgs: (tileSize) => buildArgs({
          input: tempFirst,
          output: tempSecond,
          modelsPath: resources.models,
          model: "avelune-standard-4x",
          payload: { ...payload, tileSize, useCustomWidth: false, ttaMode: strength >= 65 },
          forceWidth: target.targetWidth
        })
      });
      verifyOutput(tempSecond);
      fs.rmSync(tempFirst, { force: true });
      const published = publishAtomic(tempSecond, finalPath, payload.overwrite);
      preserveMetadataSafely(payload.imagePath, published, payload, onProgress);
      onProgress?.("100%\n");
      return published;
    }

    await runEngineWithTileFallback({
      enginePath: resources.engine,
      outputPath: tempFirst,
      signal,
      onProgress,
      initialTileSize: Number(payload.tileSize) || 0,
      makeArgs: (tileSize) => buildArgs({ input: payload.imagePath, output: tempFirst, modelsPath, model: payload.model, payload: { ...payload, tileSize } })
    });
    verifyOutput(tempFirst);
    if (needsRefinement) {
      onProgress?.("Resizing: second refinement pass\n");
      await runEngineWithTileFallback({
        enginePath: resources.engine,
        outputPath: tempSecond,
        signal,
        onProgress,
        initialTileSize: Number(payload.tileSize) || 0,
        makeArgs: (tileSize) => buildArgs({ input: tempFirst, output: tempSecond, modelsPath, model: payload.model, payload: { ...payload, tileSize }, forceWidth: target.targetWidth })
      });
      verifyOutput(tempSecond);
      fs.rmSync(tempFirst, { force: true });
      const published = publishAtomic(tempSecond, finalPath, payload.overwrite);
      preserveMetadataSafely(payload.imagePath, published, payload, onProgress);
      return published;
    }
    const published = publishAtomic(tempFirst, finalPath, payload.overwrite);
    preserveMetadataSafely(payload.imagePath, published, payload, onProgress);
    return published;
  } catch (error) {
    fs.rmSync(tempFirst, { force: true });
    if (tempSecond) fs.rmSync(tempSecond, { force: true });
    throw error;
  }
}

async function processBatch({ app, isPackaged, payload, customModelsPath, signal, onProgress, onItem, waitIfPaused }) {
  const files = Array.isArray(payload.files) && payload.files.length ? payload.files : listImageFiles(payload.batchFolderPath);
  const folderName = `avelune_${payload.saveImageAs}_${payload.model}_${payload.scale}x`;
  const resultDirectory = path.join(payload.outputPath, folderName);
  fs.mkdirSync(resultDirectory, { recursive: true });
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < files.length; index += 1) {
    const inputFile = files[index];
    if (signal.aborted) throw signal.reason || new Error("Задача отменена.");
    if (waitIfPaused) await waitIfPaused(signal);
    const itemId = crypto.createHash("sha1").update(inputFile).digest("hex").slice(0, 16);
    const itemStartedAt = Date.now();
    onItem?.({ state: "running", itemId, index, total: files.length, input: inputFile, name: path.basename(inputFile), startedAt: itemStartedAt });
    const singlePayload = { ...payload, imagePath: inputFile, outputPath: resultDirectory, overwrite: false };
    const expectedOutput = path.join(resultDirectory, outputName(inputFile, singlePayload));
    if (payload.skipExisting && fs.existsSync(expectedOutput)) {
      completed += 1;
      onItem?.({ state: "skipped", itemId, index, total: files.length, input: inputFile, name: path.basename(inputFile), output: expectedOutput, progress: 100 });
      onProgress?.(`${completed + failed}/${files.length} ${Math.round(((completed + failed) / files.length) * 100)}%\n`);
      continue;
    }
    try {
      const result = await processSingle({ app, isPackaged, payload: singlePayload, customModelsPath, signal, doublePass: false, onProgress: (text) => {
        onProgress?.(`${index + 1}/${files.length} ${text}`);
        const percent = String(text || "").match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
        if (percent) onItem?.({ state: "running", itemId, index, total: files.length, input: inputFile, name: path.basename(inputFile), progress: Math.max(0, Math.min(100, Number(percent[1].replace(",", ".")))) });
      } });
      completed += 1;
      onItem?.({ state: "completed", itemId, index, total: files.length, input: inputFile, name: path.basename(inputFile), output: result, progress: 100, elapsedMs: Date.now() - itemStartedAt });
    } catch (error) {
      if (signal.aborted) throw error;
      failed += 1;
      onItem?.({ state: "failed", itemId, index, total: files.length, input: inputFile, name: path.basename(inputFile), error: sanitizeEngineDiagnostic(error?.message || error), progress: 0, elapsedMs: Date.now() - itemStartedAt });
      if (!payload.continueOnError) throw error;
    }
    onProgress?.(`${completed + failed}/${files.length} ${Math.round(((completed + failed) / files.length) * 100)}%\n`);
  }
  return { resultDirectory, completed, failed, total: files.length };
}

module.exports = {
  DEFAULT_ENGINE_TIMEOUT_MS, DEFAULT_INACTIVITY_TIMEOUT_MS,
  modelNativeScale, resourcePaths, buildArgs, runEngine, verifyOutput, publishAtomic, outputName, availableOutputPath,
  processSingle, processBatch, terminateProcessTree, sanitizeEngineDiagnostic, progressFromEngineChunk, assertResources,
  runEngineWithTileFallback, isLikelyGpuMemoryError, preserveMetadataSafely
};
