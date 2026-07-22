"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { getImageInfo } = require("./image-info");
const { verifyPackagedResource } = require("./integrity");
const {
  sanitizeBaseName,
  validateTargetDimensions,
  modelFilesExist,
  listImageFiles
} = require("./validators");

function sanitizeEngineDiagnostic(value) {
  return String(value || "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/upscayl(?:ed)?/gi, "Avelune")
    .replace(/^[ЁЯЩМРЎЃ]{2,8}\s+(?=Avelune)/, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u0400-\u04ff]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 4000);
}

function progressFromEngineChunk(chunk) {
  const ascii = Buffer.isBuffer(chunk) ? chunk.toString("latin1") : String(chunk || "");
  const lines = ascii
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\x20-\x7e]/g, "").trim())
    .filter(Boolean);

  const safe = [];
  for (const line of lines) {
    const percent = line.match(/(?:^|\s)(\d{1,3}(?:[.,]\d+)?)\s*%/);
    if (percent) {
      const normalized = Math.max(0, Math.min(100, Number(percent[1].replace(",", "."))));
      if (Number.isFinite(normalized)) safe.push(`${normalized.toFixed(normalized % 1 ? 1 : 0)}%\n`);
      continue;
    }
    if (/resiz|convert|tile/i.test(line)) {
      safe.push(`${sanitizeEngineDiagnostic(line)}\n`);
    }
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
  return {
    root,
    engine: path.join(root, "bin", "avelune-engine.exe"),
    gpuInfo: path.join(root, "bin", "avelune-gpu-info.exe"),
    models: path.join(root, "models")
  };
}

function buildArgs({ input, output, modelsPath, model, payload, forceWidth }) {
  const args = ["-i", input, "-o", output, "-m", modelsPath, "-n", model];
  const nativeScale = modelNativeScale(model);
  if (forceWidth) {
    args.push("-w", String(forceWidth));
  } else if (payload.useCustomWidth) {
    args.push("-w", String(payload.customWidth));
  } else if (Number(payload.scale) !== nativeScale) {
    args.push("-s", String(payload.scale));
  }
  if (payload.gpuId) args.push("-g", payload.gpuId);
  args.push("-f", payload.saveImageAs);
  args.push("-c", String(payload.compression));
  if (payload.tileSize) args.push("-t", String(payload.tileSize));
  if (payload.ttaMode) args.push("-x");
  return args;
}

function terminateProcessTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    try { child.kill(); } catch {}
  }
}

function runEngine({ enginePath, args, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";
    let stdout = "";
    const child = spawn(enginePath, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const consume = (chunk, target) => {
      const raw = chunk.toString("latin1");
      if (target === "stderr") stderr = (stderr + raw).slice(-32_000);
      else stdout = (stdout + raw).slice(-32_000);
      if (onProgress) {
        for (const update of progressFromEngineChunk(chunk)) onProgress(update);
      }
    };

    const onAbort = () => {
      terminateProcessTree(child);
      finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Задача отменена.")));
    };

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => consume(chunk, "stdout"));
    child.stderr.on("data", (chunk) => consume(chunk, "stderr"));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, closeSignal) => {
      finish(() => {
        if (code === 0) {
          onProgress?.("Avelune: обработка успешно завершена.\n");
          return resolve({
            code,
            stdout: sanitizeEngineDiagnostic(stdout),
            stderr: sanitizeEngineDiagnostic(stderr)
          });
        }
        const detail = sanitizeEngineDiagnostic(
          stderr || stdout || `код ${code}${closeSignal ? `, сигнал ${closeSignal}` : ""}`
        );
        reject(new Error(`AI-движок завершился с ошибкой: ${detail || `код ${code}`}`));
      });
    });
  });
}

function verifyOutput(filePath) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.size < 32) throw new Error("AI-движок не создал корректный файл результата.");
  return getImageInfo(filePath);
}

function publishAtomic(tempPath, finalPath, overwrite) {
  verifyOutput(tempPath);
  if (fs.existsSync(finalPath)) {
    if (!overwrite) {
      fs.rmSync(tempPath, { force: true });
      verifyOutput(finalPath);
      return finalPath;
    }
    fs.rmSync(finalPath, { force: true });
  }
  fs.renameSync(tempPath, finalPath);
  return finalPath;
}

function makeTempPath(outputDirectory, format) {
  return path.join(outputDirectory, `.avelune-${crypto.randomUUID()}.${format}`);
}

function outputName(inputPath, payload) {
  const base = sanitizeBaseName(path.parse(inputPath).name);
  const dimension = payload.useCustomWidth ? `${payload.customWidth}px` : `${payload.scale}x`;
  return `${base}_avelune_${dimension}_${payload.model}.${payload.saveImageAs}`;
}

function assertResources(resources, modelsPath, model) {
  const enginePath = resources.engine;
  if (!fs.existsSync(enginePath)) throw new Error("Не найден исполняемый файл AI-движка.");
  verifyPackagedResource(resources.root, path.join("bin", "avelune-engine.exe"));
  if (!modelFilesExist(modelsPath, model)) throw new Error(`Файлы AI-модели «${model}» не найдены.`);
  if (path.resolve(modelsPath) === path.resolve(resources.models)) {
    verifyPackagedResource(resources.root, path.join("models", `${model}.bin`));
    verifyPackagedResource(resources.root, path.join("models", `${model}.param`));
  }
}

async function processSingle({ app, isPackaged, payload, customModelsPath, signal, onProgress, doublePass = false }) {
  const resources = resourcePaths(app, isPackaged);
  const modelsPath = modelFilesExist(resources.models, payload.model) ? resources.models : customModelsPath;
  if (!modelsPath) throw new Error("Папка пользовательской AI-модели не выбрана.");
  assertResources(resources, modelsPath, payload.model);

  const sourceInfo = getImageInfo(payload.imagePath);
  const target = validateTargetDimensions(sourceInfo.width, sourceInfo.height, payload);
  const finalPath = path.join(payload.outputPath, outputName(payload.imagePath, payload));
  if (fs.existsSync(finalPath) && !payload.overwrite) {
    verifyOutput(finalPath);
    return finalPath;
  }

  const tempFirst = makeTempPath(payload.outputPath, payload.saveImageAs);
  const tempSecond = doublePass ? makeTempPath(payload.outputPath, payload.saveImageAs) : null;
  try {
    await runEngine({
      enginePath: resources.engine,
      args: buildArgs({ input: payload.imagePath, output: tempFirst, modelsPath, model: payload.model, payload }),
      signal,
      onProgress
    });
    verifyOutput(tempFirst);

    if (doublePass) {
      onProgress?.("Resizing: second refinement pass\n");
      await runEngine({
        enginePath: resources.engine,
        args: buildArgs({ input: tempFirst, output: tempSecond, modelsPath, model: payload.model, payload, forceWidth: target.targetWidth }),
        signal,
        onProgress
      });
      verifyOutput(tempSecond);
      fs.rmSync(tempFirst, { force: true });
      return publishAtomic(tempSecond, finalPath, payload.overwrite);
    }

    return publishAtomic(tempFirst, finalPath, payload.overwrite);
  } catch (error) {
    fs.rmSync(tempFirst, { force: true });
    if (tempSecond) fs.rmSync(tempSecond, { force: true });
    throw error;
  }
}

async function processBatch({ app, isPackaged, payload, customModelsPath, signal, onProgress }) {
  const files = listImageFiles(payload.batchFolderPath);
  const folderName = `avelune_${payload.saveImageAs}_${payload.model}_${payload.scale}x`;
  const resultDirectory = path.join(payload.outputPath, folderName);
  fs.mkdirSync(resultDirectory, { recursive: true });

  let completed = 0;
  for (const inputFile of files) {
    if (signal.aborted) throw signal.reason || new Error("Задача отменена.");
    const singlePayload = { ...payload, imagePath: inputFile, outputPath: resultDirectory, overwrite: false };
    await processSingle({
      app,
      isPackaged,
      payload: singlePayload,
      customModelsPath,
      signal,
      doublePass: false,
      onProgress: (text) => onProgress?.(`${completed + 1}/${files.length} ${text}`)
    });
    completed += 1;
    onProgress?.(`${completed}/${files.length} ${Math.round((completed / files.length) * 100)}%\n`);
  }
  return resultDirectory;
}

module.exports = {
  modelNativeScale,
  resourcePaths,
  buildArgs,
  runEngine,
  verifyOutput,
  publishAtomic,
  outputName,
  processSingle,
  processBatch,
  terminateProcessTree,
  sanitizeEngineDiagnostic,
  progressFromEngineChunk
};
