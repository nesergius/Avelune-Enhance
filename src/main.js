"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell, session } = require("electron");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { CHANNELS } = require("./constants");
const { validateSinglePayload, validateBatchPayload, validateClipboardPayload, existingDirectory, absolutePath, imagePath, jobId, listImageFiles } = require("./validators");
const { getImageInfo } = require("./image-info");
const { verifyPackagedResource, verifyAllPackagedResources } = require("./integrity");
const { JobManager } = require("./job-manager");
const { processSingle, processBatch, resourcePaths, availableOutputPath } = require("./engine");
const { preserveImageMetadata } = require("./metadata");
const { getStatus: getLocalAiStatus, installPack: installLocalAiPack, removePack: removeLocalAiPack, restoreLocal } = require("./local-ai");
const { initializeUpdater } = require("./updater");

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const portableData = path.join(process.env.PORTABLE_EXECUTABLE_DIR, "AveluneData");
  fs.mkdirSync(portableData, { recursive: true });
  app.setPath("userData", portableData);
  app.setPath("logs", path.join(portableData, "logs"));
}

// Both packaged UI probes were still failing after the window was made
// visible, now with a distinct Chromium GPU-process error:
// "GPU state invalid after WaitForGetOffsetInRange". That is a real D3D/
// ANGLE command-buffer desync in the hardware GPU path (seen on machines
// with flaky GPU drivers, hybrid-graphics power state changes, remote
// desktop/virtualized displays, etc.) — it is independent of window
// position or visibility and was never actually about "is the window
// shown". When the GPU process loses its context mid-probe, Chromium has
// to restart it, which stalls the very first requestAnimationFrame by
// hundreds of milliseconds — the same symptom as before, but a different
// root cause. The probe only needs *real, correctly-timed frames*, not
// hardware-accelerated ones, so force software (SwiftShader) rendering
// for probe launches specifically. Normal user launches are unaffected
// and keep full GPU acceleration.
if (safeAbsoluteArgument("--avelune-ui-probe=") || safeAbsoluteArgument("--avelune-runtime-probe=")) {
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let customModelsPath = null;
let integrityReady = Promise.resolve(0);
const jobManager = new JobManager({ maxQueued: 64 });
const batchControls = new Map();
const isDevelopment = !app.isPackaged;
const APP_DISPLAY_VERSION = "2.0.0 RC6";
const BUILD_VERSION = "2.0.0.600";

const MAX_PREVIEW_FALLBACK_BYTES = 128 * 1024 * 1024;
const PREVIEW_MIME = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".webp": "image/webp"
});

function userSettingsPath() { return path.join(app.getPath("userData"), "secure-settings.json"); }
function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(userSettingsPath(), "utf8"));
    if (parsed && typeof parsed.customModelsPath === "string" && fs.existsSync(parsed.customModelsPath)) customModelsPath = parsed.customModelsPath;
  } catch {}
}
async function saveSettings() {
  try {
    await fsp.mkdir(app.getPath("userData"), { recursive: true });
    const target = userSettingsPath();
    const temp = `${target}.${process.pid}.tmp`;
    await fsp.writeFile(temp, JSON.stringify({ customModelsPath }, null, 2), { encoding: "utf8", mode: 0o600 });
    await fsp.rename(temp, target);
  } catch {}
}
function isTrustedEvent(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.sender.isDestroyed()) return false;
  const url = event.senderFrame?.url || event.sender.getURL();
  return url.startsWith("file:") && url.endsWith("/renderer/out/index.html");
}
function requireTrustedEvent(event) { if (!isTrustedEvent(event)) throw new Error("Недоверенный IPC-запрос заблокирован."); }
function safeSend(channel, payload) { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(channel, payload); }
function cleanError(error) { return (error instanceof Error ? error.message : String(error || "Неизвестная ошибка")).replace(/\x1b\[[0-9;]*m/g, "").replace(/[\r\n]+/g, " ").slice(0, 1200); }
function logLine(level, message) {
  try { const dir = app.getPath("logs"); fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, "avelune.log"), `${new Date().toISOString()} [${level}] ${message}\n`, "utf8"); } catch {}
}
function listModels(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory, { withFileTypes: true });
  const params = new Set(files.filter((e) => e.isFile() && e.name.endsWith(".param")).map((e) => e.name.slice(0, -6)));
  const bins = new Set(files.filter((e) => e.isFile() && e.name.endsWith(".bin")).map((e) => e.name.slice(0, -4)));
  return [...params].filter((id) => bins.has(id) && /^[A-Za-z0-9._-]+$/.test(id)).sort();
}
function jobEnvelope(jobId, jobType, key, value) { return { jobId, jobType, [key]: value }; }
function notifyJobError(jobId, jobType, error) {
  const message = cleanError(error); logLine("ERROR", `${jobType || "unknown"}/${jobId || "unassigned"}: ${message}`);
  safeSend(CHANNELS.AVELUNE_ERROR, jobEnvelope(jobId || "", jobType || "unknown", "error", message));
}
function registerJob({ channel, type, payload, runner, doneChannel, progressChannel }) {
  const immutablePayload = Object.freeze({ ...payload });
  try {
    const id = jobManager.enqueue(type, async ({ id: jobId, signal }) => {
      const progress = (value) => safeSend(progressChannel, jobEnvelope(jobId, type, "value", String(value || "")));
      try {
        await integrityReady;
        const result = await runner({ signal, progress, payload: immutablePayload });
        if (!signal.aborted) safeSend(doneChannel, jobEnvelope(jobId, type, "result", result));
      } catch (error) { if (!signal.aborted) notifyJobError(jobId, type, error); }
    }, { id: immutablePayload.requestId, metadata: { channel } });
    logLine("INFO", `Queued ${type} job ${id} from ${channel}`);
    return id;
  } catch (error) { notifyJobError(immutablePayload.requestId, type, error); return null; }
}


async function processSingleWithOptionalLocalRestore({ signal, progress, payload }) {
  if (!payload.generativeRestore) {
    return processSingle({ app, isPackaged: app.isPackaged, payload, customModelsPath, signal, doublePass: false, onProgress: progress });
  }
  const originalInfo = getImageInfo(payload.imagePath);
  const targetWidth = payload.useCustomWidth ? Number(payload.customWidth) : Math.min(32768, originalInfo.width * Number(payload.scale || 4));
  const tempRoot = path.join(app.getPath("temp"), "AveluneEnhance", `local-photo-restore-${crypto.randomUUID()}`);
  await fsp.mkdir(tempRoot, { recursive: true });
  const restoredPath = path.join(tempRoot, "photo-restored.png");
  try {
    await restoreLocal({ app, inputPath: payload.imagePath, outputPath: restoredPath, strength: payload.neuralRestoreStrength || 80, scale: 2, tile: Number(payload.tileSize) || 0, quality: payload.restoreQuality || "balanced", tier: payload.restoreEngine === "ultra" ? "ultra" : "pro", signal, onProgress: progress });
    const localPayload = { ...payload, requestId: crypto.randomUUID(), imagePath: restoredPath, model: "avelune-standard-4x", neuralRestore: false, generativeRestore: false, useCustomWidth: true, customWidth: String(Math.max(64, targetWidth)), ttaMode: true, overwrite: false, copyMetadata: false, preserveColorProfile: false };
    const result = await processSingle({ app, isPackaged: app.isPackaged, payload: localPayload, customModelsPath, signal, doublePass: false, onProgress: (text) => {
      const match = String(text || "").match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
      if (match) progress?.(`${Math.round(70 + Math.min(100, Number(match[1].replace(",", "."))) * 0.30)}%\n`);
      else if (text) progress?.(`Финальный апскейл: ${String(text).trim()}\n`);
    }});
    const ext = path.extname(result);
    const tierSuffix = payload.restoreEngine === "ultra" ? "photo_restore_ultra" : "photo_restore_pro";
    const desired = availableOutputPath(path.join(payload.outputPath, `${path.parse(payload.imagePath).name}_avelune_${tierSuffix}${ext}`), payload.overwrite);
    await fsp.rename(result, desired);
    try { preserveImageMetadata(payload.imagePath, desired, payload); } catch {}
    progress?.("100%\n");
    return desired;
  } finally { await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {}); }
}

function createBatchControl(jobId) {
  const control = {
    paused: false,
    waiters: [],
    pause() { this.paused = true; },
    resume() { this.paused = false; for (const resolve of this.waiters.splice(0)) resolve(); },
    async wait(signal) {
      while (this.paused) {
        if (signal?.aborted) throw signal.reason || new Error("Задача отменена.");
        await new Promise((resolve, reject) => {
          const onAbort = () => { signal?.removeEventListener("abort", onAbort); reject(signal.reason || new Error("Задача отменена.")); };
          signal?.addEventListener("abort", onAbort, { once: true });
          this.waiters.push(() => { signal?.removeEventListener("abort", onAbort); resolve(); });
        });
      }
    }
  };
  batchControls.set(jobId, control);
  return control;
}

function batchControlFor(jobId) { return batchControls.get(String(jobId || "")); }

function runJsonExecutable(filePath, timeoutMs = 10000) {
  return new Promise((resolve) => execFile(filePath, [], { windowsHide: true, timeout: timeoutMs, encoding: "utf8", maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return resolve({ ok: false, error: cleanError(stderr || error.message) });
    try { resolve({ ok: true, value: JSON.parse(String(stdout || "").trim()) }); } catch (parseError) { resolve({ ok: false, error: cleanError(parseError) }); }
  }));
}
async function getGpuAdapters(resources) {
  if (process.platform !== "win32" || !fs.existsSync(resources.gpuInfo)) return [];
  try { await verifyPackagedResource(resources.root, path.join("win", "bin", "avelune-gpu-info.exe")); } catch (error) { logLine("WARN", cleanError(error)); return []; }
  const result = await runJsonExecutable(resources.gpuInfo);
  if (!result.ok || !Array.isArray(result.value?.adapters)) { if (result.error) logLine("WARN", `DXGI diagnostics: ${result.error}`); return []; }
  return result.value.adapters.filter((a) => a && typeof a.name === "string").map((a) => ({ index: Number(a.index)||0, name:a.name, vendorId:Number(a.vendorId)||0, deviceId:Number(a.deviceId)||0, dedicatedVideoMemoryBytes:Number(a.dedicatedVideoMemoryBytes)||0, sharedSystemMemoryBytes:Number(a.sharedSystemMemoryBytes)||0, softwareAdapter:Boolean(a.softwareAdapter) }));
}

function registerIpc() {
  ipcMain.handle(CHANNELS.SELECT_FILE, async (event) => { requireTrustedEvent(event); const result = await dialog.showOpenDialog(mainWindow,{title:"Выберите изображение",properties:["openFile"],filters:[{name:"Изображения",extensions:["png","jpg","jpeg","jfif","webp"]}]}); return result.canceled?null:result.filePaths[0]; });
  ipcMain.handle(CHANNELS.SELECT_FOLDER, async (event) => { requireTrustedEvent(event); const result = await dialog.showOpenDialog(mainWindow,{title:"Выберите папку",properties:["openDirectory","createDirectory"]}); return result.canceled?null:result.filePaths[0]; });
  ipcMain.handle(CHANNELS.SELECT_CUSTOM_MODEL_FOLDER, async (event) => {
    requireTrustedEvent(event); const result=await dialog.showOpenDialog(mainWindow,{title:"Выберите папку пользовательских AI-моделей",properties:["openDirectory"]}); if(result.canceled)return null;
    const selected=existingDirectory(result.filePaths[0],"Папка моделей"); const models=listModels(selected); if(!models.length)throw new Error("В папке не найдено ни одной пары файлов .bin и .param."); customModelsPath=selected; await saveSettings(); safeSend(CHANNELS.CUSTOM_MODEL_FILES_LIST,models); return selected;
  });
  ipcMain.on(CHANNELS.GET_MODELS_LIST,(event)=>{try{requireTrustedEvent(event);safeSend(CHANNELS.CUSTOM_MODEL_FILES_LIST,listModels(customModelsPath));}catch(error){notifyJobError("","models",error);}});

  ipcMain.on(CHANNELS.AVELUNE,(event,raw)=>{try{requireTrustedEvent(event);const payload=validateSinglePayload(raw);registerJob({channel:CHANNELS.AVELUNE,type:"single",payload,progressChannel:CHANNELS.AVELUNE_PROGRESS,doneChannel:CHANNELS.AVELUNE_DONE,runner:({signal,progress,payload})=>processSingleWithOptionalLocalRestore({signal,progress,payload})});}catch(error){notifyJobError(raw?.requestId,"single",error);}});
  ipcMain.on(CHANNELS.DOUBLE_AVELUNE,(event,raw)=>{try{requireTrustedEvent(event);const payload=validateSinglePayload(raw);registerJob({channel:CHANNELS.DOUBLE_AVELUNE,type:"double",payload,progressChannel:CHANNELS.DOUBLE_AVELUNE_PROGRESS,doneChannel:CHANNELS.DOUBLE_AVELUNE_DONE,runner:({signal,progress,payload})=>processSingle({app,isPackaged:app.isPackaged,payload,customModelsPath,signal,doublePass:true,onProgress:progress})});}catch(error){notifyJobError(raw?.requestId,"double",error);}});
  ipcMain.on(CHANNELS.FOLDER_AVELUNE,(event,raw)=>{try{requireTrustedEvent(event);const payload=validateBatchPayload(raw);const control=createBatchControl(payload.requestId);registerJob({channel:CHANNELS.FOLDER_AVELUNE,type:"batch",payload,progressChannel:CHANNELS.FOLDER_AVELUNE_PROGRESS,doneChannel:CHANNELS.FOLDER_AVELUNE_DONE,runner:async({signal,progress,payload})=>{try{return await processBatch({app,isPackaged:app.isPackaged,payload,customModelsPath,signal,onProgress:progress,onItem:(item)=>safeSend(CHANNELS.BATCH_ITEM_EVENT,{jobId:payload.requestId,...item}),waitIfPaused:(activeSignal)=>control.wait(activeSignal)});}finally{batchControls.delete(payload.requestId);}}});}catch(error){notifyJobError(raw?.requestId,"batch",error);}});
  ipcMain.on(CHANNELS.PAUSE_BATCH,(event,raw)=>{try{requireTrustedEvent(event);batchControlFor(raw?.jobId)?.pause();safeSend(CHANNELS.BATCH_ITEM_EVENT,{jobId:String(raw?.jobId||""),state:"paused"});}catch(error){notifyJobError(raw?.jobId,"pause-batch",error);}});
  ipcMain.on(CHANNELS.RESUME_BATCH,(event,raw)=>{try{requireTrustedEvent(event);batchControlFor(raw?.jobId)?.resume();safeSend(CHANNELS.BATCH_ITEM_EVENT,{jobId:String(raw?.jobId||""),state:"resumed"});}catch(error){notifyJobError(raw?.jobId,"resume-batch",error);}});
  ipcMain.on(CHANNELS.STOP,(event,raw)=>{try{requireTrustedEvent(event);const id=String(raw?.jobId||"");if(!jobManager.cancel(id))logLine("WARN",`Cancel ignored for unknown job ${id}`);}catch(error){notifyJobError(raw?.jobId,"cancel",error);}});
  ipcMain.on(CHANNELS.OPEN_FOLDER,async(event,raw)=>{try{requireTrustedEvent(event);const target=absolutePath(typeof raw==="string"?raw:raw?.path,"Путь");const stat=await fsp.stat(target);if(raw?.revealFile&&stat.isFile()){shell.showItemInFolder(target);return;}const openTarget=stat.isFile()?path.dirname(target):target;const error=await shell.openPath(openTarget);if(error)throw new Error(error);}catch(error){notifyJobError("","open-path",error);}});
  ipcMain.on(CHANNELS.PASTE_IMAGE, async (event, raw) => {
    let requestId = "";
    try {
      requireTrustedEvent(event);
      requestId = jobId(raw?.requestId);
      const payload = validateClipboardPayload(raw);
      // Windows Defender's Controlled Folder Access (and/or first-run
      // real-time scanning of a freshly built/signed exe's first disk
      // writes) commonly slows down or virtualizes writes to Pictures/
      // Documents/Desktop for apps without an established reputation yet.
      // That fully explains the clipboard probe's round trip completing
      // correctly (confirmed by clipboardDebug) well past any reasonable
      // timeout: the write itself was the bottleneck, not our code. Real
      // users still get Pictures as the default; only the automated probe
      // writes to its own disposable userData directory, which was never
      // going to be inside a protected folder.
      const directory = payload.outputPath
        || (uiProbePath() ? path.join(app.getPath("userData"), "probe-clipboard") : app.getPath("pictures"));
      await fsp.mkdir(directory, { recursive: true });
      const target = path.join(directory, `avelune-clipboard-${crypto.randomUUID()}.${payload.extension}`);
      await fsp.writeFile(target, payload.buffer, { flag: "wx", mode: 0o600 });
      try {
        getImageInfo(target);
      } catch (error) {
        await fsp.rm(target, { force: true });
        throw error;
      }
      safeSend(CHANNELS.PASTE_IMAGE_SAVE_SUCCESS, { requestId: payload.requestId, path: target });
    } catch (error) {
      safeSend(CHANNELS.PASTE_IMAGE_SAVE_ERROR, { requestId, error: cleanError(error) });
    }
  });

  ipcMain.handle(CHANNELS.GET_SYSTEM_INFO,async(event)=>{requireTrustedEvent(event);const resources=resourcePaths(app,app.isPackaged);const[gpuInfo,adapters]=await Promise.all([app.getGPUInfo("complete").catch(()=>null),getGpuAdapters(resources)]);const active=adapters.find((a)=>!a.softwareAdapter&&a.dedicatedVideoMemoryBytes>0)||adapters.find((a)=>!a.softwareAdapter)||null;const chromiumDevice=gpuInfo?.gpuDevice?.[0]||gpuInfo?.gpuDevice?.active||null;return{platform:process.platform==="win32"?"win":process.platform==="darwin"?"mac":"linux",release:os.release(),model:os.cpus()[0]?.model||"—",cpuCount:os.cpus().length,totalMemory:os.totalmem(),gpu:{deviceString:active?.name||chromiumDevice?.deviceString||chromiumDevice?.vendorString||"GPU с поддержкой Vulkan",vendorString:chromiumDevice?.vendorString||"",dedicatedVideoMemoryBytes:active?.dedicatedVideoMemoryBytes||0},adapters};});
  ipcMain.handle(CHANNELS.GET_APP_VERSION,(event)=>{requireTrustedEvent(event);return`v${APP_DISPLAY_VERSION}`;});
  ipcMain.handle(CHANNELS.GET_IMAGE_PREVIEW, async (event, rawPath) => {
    requireTrustedEvent(event);
    const filePath = imagePath(rawPath, "Изображение предпросмотра");
    const stat = await fsp.stat(filePath);
    if (stat.size > MAX_PREVIEW_FALLBACK_BYTES) {
      throw new Error("Файл слишком большой для резервного предпросмотра.");
    }
    const buffer = await fsp.readFile(filePath);
    return {
      mime: PREVIEW_MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      buffer
    };
  });
  ipcMain.handle(CHANNELS.SCAN_BATCH_FOLDER, async (event, rawPath) => {
    requireTrustedEvent(event);
    const directory = existingDirectory(rawPath, "Исходная папка");
    const files = listImageFiles(directory);
    return files.slice(0, 10000).map((filePath, index) => {
      let info = null;
      try { info = getImageInfo(filePath); } catch {}
      const stat = fs.statSync(filePath);
      return { id: crypto.createHash("sha1").update(filePath).digest("hex").slice(0,16), index, path: filePath, name: path.basename(filePath), width: info?.width || 0, height: info?.height || 0, bytes: stat.size, state: "queued", progress: 0 };
    });
  });
  ipcMain.handle(CHANNELS.GET_QUEUE_STATUS, (event) => { requireTrustedEvent(event); return jobManager.getStatus(); });
  ipcMain.handle("avelune:get-local-ai-status", (event) => { requireTrustedEvent(event); return getLocalAiStatus(app); });
  ipcMain.handle("avelune:install-local-ai", async (event, raw) => { requireTrustedEvent(event); return installLocalAiPack({ app, isPackaged: app.isPackaged, backend: String(raw?.backend || "auto"), tier: String(raw?.tier || "pro"), onProgress: (value) => safeSend("avelune:local-ai-progress", value) }); });
  ipcMain.handle("avelune:remove-local-ai", async (event, raw) => { requireTrustedEvent(event); return removeLocalAiPack(app, String(raw?.tier || "pro")); });
  ipcMain.handle(CHANNELS.RUN_GPU_BENCHMARK, async (event) => {
    requireTrustedEvent(event);
    await integrityReady;
    const resources = resourcePaths(app, app.isPackaged);
    const adapters = await getGpuAdapters(resources);
    const active = adapters.find((item) => !item.softwareAdapter && item.dedicatedVideoMemoryBytes > 0) || adapters[0] || null;
    const vram = Number(active?.dedicatedVideoMemoryBytes || 0);
  const heuristicTile = vram >= 7.5 * 1024 ** 3 ? 0 : vram >= 4 * 1024 ** 3 ? 256 : vram >= 2 * 1024 ** 3 ? 128 : 64;
    const benchmarkInput = path.join(resources.root, "benchmark", "benchmark-input.png");
    if (!fs.existsSync(benchmarkInput)) return { adapter: active, recommendedTile: heuristicTile, measured: false, reason: "benchmark fixture unavailable" };
    const benchmarkRoot = path.join(app.getPath("temp"), "AveluneEnhance", `benchmark-${crypto.randomUUID()}`);
    await fsp.mkdir(benchmarkRoot, { recursive: true });
    const candidates = [...new Set([heuristicTile, 256, 128, 64])].filter((value) => value === 0 || value >= 64);
    const results = [];
    try {
      for (const tileSize of candidates.slice(0, 3)) {
        const requestId = crypto.randomUUID();
        const started = Date.now();
        try {
          const output = await processSingle({ app, isPackaged: app.isPackaged, customModelsPath, signal: new AbortController().signal, doublePass: false, onProgress: null, payload: validateSinglePayload({ requestId, imagePath: benchmarkInput, outputPath: benchmarkRoot, model: "avelune-standard-4x", saveImageAs: "png", scale: "2", useCustomWidth: false, customWidth: "", tileSize, compression: 100, gpuId: "", ttaMode: false, overwrite: false, copyMetadata: false, preserveColorProfile: false, neuralRestore: false, neuralRestoreStrength: 70 }) });
          results.push({ tileSize, elapsedMs: Date.now() - started, ok: true });
          await fsp.rm(output, { force: true }).catch(() => {});
        } catch (error) { results.push({ tileSize, elapsedMs: Date.now() - started, ok: false, error: cleanError(error) }); }
      }
      const successful = results.filter((item) => item.ok).sort((a,b) => a.elapsedMs - b.elapsedMs);
      return { adapter: active, recommendedTile: successful[0]?.tileSize ?? heuristicTile, measured: successful.length > 0, results };
    } finally { await fsp.rm(benchmarkRoot, { recursive: true, force: true }).catch(() => {}); }
  });
  ipcMain.handle(CHANNELS.GET_DIAGNOSTICS,async(event)=>{requireTrustedEvent(event);const resources=resourcePaths(app,app.isPackaged);const adapters=await getGpuAdapters(resources);return{version:app.getVersion(),displayVersion:APP_DISPLAY_VERSION,buildVersion:BUILD_VERSION,electron:process.versions.electron,chrome:process.versions.chrome,node:process.versions.node,platform:process.platform,arch:process.arch,release:os.release(),cpu:os.cpus()[0]?.model||"",cpuCount:os.cpus().length,totalMemory:os.totalmem(),gpuFeatureStatus:app.getGPUFeatureStatus(),gpuAdapters:adapters,dedicatedVideoMemoryBytes:Math.max(0,...adapters.map((a)=>a.dedicatedVideoMemoryBytes||0)),enginePresent:fs.existsSync(resources.engine),gpuInfoHelperPresent:fs.existsSync(resources.gpuInfo),modelsPresent:fs.existsSync(resources.models),jobManager:jobManager.getStatus()};});
}

function commandLineValue(prefix){const raw=process.argv.find((argument)=>String(argument).startsWith(prefix));return raw?String(raw).slice(prefix.length):"";}
function safeAbsoluteArgument(prefix){const raw=commandLineValue(prefix);if(!raw)return null;const candidate=path.normalize(raw);if(!path.isAbsolute(candidate)||candidate.includes("\0"))return null;return candidate;}
function runtimeProbePath(){return safeAbsoluteArgument("--avelune-runtime-probe=");}
function uiProbePath(){return safeAbsoluteArgument("--avelune-ui-probe=");}
function probeWindowSize(){const raw=commandLineValue("--avelune-probe-size=");const match=raw.match(/^(\d{3,5})x(\d{3,5})$/i);if(!match)return null;return{width:Math.max(820,Math.min(7680,Number(match[1]))),height:Math.max(600,Math.min(4320,Number(match[2])))};}
function writeProbeJson(targetPath,payload){const directory=path.dirname(targetPath);fs.mkdirSync(directory,{recursive:true});const temporary=`${targetPath}.${process.pid}.tmp`;fs.writeFileSync(temporary,JSON.stringify(payload,null,2),{encoding:"utf8",flag:"wx",mode:0o600});fs.renameSync(temporary,targetPath);}
function writeRuntimeProbe(targetPath){writeProbeJson(targetPath,{product:"Avelune Enhance",displayVersion:APP_DISPLAY_VERSION,appVersion:app.getVersion(),buildVersion:BUILD_VERSION,electron:process.versions.electron,chrome:process.versions.chrome,node:process.versions.node,platform:process.platform,arch:process.arch,packaged:app.isPackaged});}
function createWindow({ uiProbe = null, probeSize = null } = {}) {
  const size = probeSize || { width: 1280, height: 800 };
  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: 860,
    minHeight: 640,
    show: false,
    // UI-probe windows must become a real, composited, on-screen surface, or
    // requestAnimationFrame gets throttled to ~1 Hz (independent of the
    // `backgroundThrottling` webPreference, which only governs timers) and
    // the probe records a single bogus ~1000ms "frame". An earlier attempt
    // fixed that by showing the window far off-screen (x/y: -32000), but on
    // real Windows/GPU hardware a window placed entirely outside every
    // monitor's bounds can get an invalid swapchain/surface from the GPU
    // process ("GPU state invalid after WaitForGetOffsetInRange"), which is
    // just as unreliable as never showing it at all. The probe only ever
    // runs automatically during packaging (never in front of an end user
    // during normal app use), so there is no UX cost to letting the window
    // appear normally on-screen — that's what gives it a real GPU surface.
    backgroundColor: "#080b14",
    autoHideMenuBar: true,
    title: "Avelune Enhance",
    icon: path.join(__dirname, "..", "renderer", "out", "assets", "icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: uiProbe ? false : true,
      devTools: isDevelopment
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "out", "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (uiProbe) mainWindow?.showInactive();
    else mainWindow?.show();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  if (uiProbe) {
    mainWindow.webContents.once("did-finish-load", async () => {
      let clipboardPreviewPath = "";
      try {
        const metrics = await mainWindow.webContents.executeJavaScript(`(async () => {
          const el = (selector) => document.querySelector(selector);
          const box = (selector) => {
            const node = el(selector);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              x: Math.round(rect.x), y: Math.round(rect.y),
              width: Math.round(rect.width), height: Math.round(rect.height),
              clientWidth: node.clientWidth, clientHeight: node.clientHeight,
              scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
              overflowX: getComputedStyle(node).overflowX,
              overflowY: getComputedStyle(node).overflowY
            };
          };
          const waitFor = async (predicate, timeoutMs = 5000) => {
            const started = performance.now();
            while (performance.now() - started < timeoutMs) {
              if (predicate()) return true;
              await new Promise((resolve) => setTimeout(resolve, 25));
            }
            return false;
          };
          const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

          const doc = document.documentElement;
          const enhance = el('#view-enhance');
          const drop = el('#drop-zone');
          const preview = el('.preview-card');
          const controls = el('.enhance-workflow');
          const sidebar = el('.sidebar');
          const controlsScroll = el('.controls-scroll');
          const advanced = el('#advanced-panel');
          const topbar = el('.topbar');
          const docBox = box('html');
          const sidebarBox = box('.sidebar');
          const previewBox = box('.preview-card');
          const hardwareBox = box('#hardware-chip');
          let toastBox = null;
          const rectsOverlap = (a, b) => Boolean(
            a && b
            && a.width > 0
            && a.height > 0
            && b.width > 0
            && b.height > 0
            && a.x < b.x + b.width
            && a.x + a.width > b.x
            && a.y < b.y + b.height
            && a.y + a.height > b.y
          );

          const startButton = el('#start-button');
          const sourcePicker = el('#sidebar-select-file-button');
          const isViewportReachable = (node) => {
            if (!node) return false;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width > 0
              && rect.height > 0
              && style.display !== 'none'
              && style.visibility !== 'hidden'
              && rect.right > 0
              && rect.bottom > 0
              && rect.left < innerWidth
              && rect.top < innerHeight;
          };
          // The source action belongs to the native scrolling surface, while the
          // primary start action intentionally lives in the fixed process footer.
          // Requiring both controls to be children of .controls-scroll made every
          // RC6 viewport fail even though both actions were visible and usable.
          const primaryWorkflowReachable = Boolean(
            startButton
            && sourcePicker
            && controls
            && controlsScroll
            && controls.contains(startButton)
            && controlsScroll.contains(sourcePicker)
            && isViewportReachable(startButton)
            && isViewportReachable(sourcePicker)
          );

          // Full clipboard path: synthetic PNG -> renderer paste handler -> IPC save -> visible preview.
          const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7WQAAAAASUVORK5CYII=';
          const pngBytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
          const clipboardFile = new File([pngBytes], 'avelune-clipboard-probe.png', { type: 'image/png' });
          const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
          Object.defineProperty(pasteEvent, 'clipboardData', {
            value: { items: [{ type: 'image/png', getAsFile: () => clipboardFile }] }
          });
          document.dispatchEvent(pasteEvent);
          const clipboardWaitStarted = performance.now();
          const clipboardPreviewReady = () => {
            const image = el('#source-image');
            const source = image?.getAttribute('src') || '';
            return image?.complete === true
              && image?.naturalWidth === 1
              && image?.naturalHeight === 1
              && /^blob:/i.test(source);
          };
          const clipboardObservedDuringWait = await waitFor(clipboardPreviewReady, 20000);
          const clipboardPreviewPath = el('#source-path')?.textContent || '';
          // Capture one authoritative final snapshot, then derive both diagnostics
          // and pass/fail from that exact snapshot. This makes it impossible for
          // the report to say naturalWidth=1/naturalHeight=1/srcScheme=blob while
          // clipboardPreviewPassed is false because Chromium committed the image
          // between two separate reads of the DOM.
          const clipboardDebug = (() => {
            const image = el('#source-image');
            return {
              resolutionText: el('#source-resolution')?.textContent || '',
              srcScheme: (image?.getAttribute('src') || '').split(':')[0] || 'none',
              naturalWidth: image?.naturalWidth ?? null,
              naturalHeight: image?.naturalHeight ?? null,
              complete: image?.complete ?? null,
              waitedMs: Math.round(performance.now() - clipboardWaitStarted)
            };
          })();
          const clipboardPreviewPassed = clipboardObservedDuringWait || (
            clipboardDebug.complete === true
            && clipboardDebug.naturalWidth === 1
            && clipboardDebug.naturalHeight === 1
            && clipboardDebug.srcScheme === 'blob'
          );
          await waitFor(() => Boolean(el('.toast-stack .toast')), 1200);
          toastBox = box('.toast-stack .toast');

          // Exercise the only allowed scroll surface with advanced controls open.
          if (advanced) advanced.open = true;
          await nextFrame();
          await nextFrame();
          const frameDeltas = [];
          let layoutShift = 0;
          let observer = null;
          try {
            observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) layoutShift += entry.value;
              }
            });
            observer.observe({ type: 'layout-shift' });
          } catch {}
          const maxScroll = Math.max(0, controlsScroll.scrollHeight - controlsScroll.clientHeight);
          if (maxScroll > 0) {
            const duration = 900;
            let started = null;
            let previous = null;
            await new Promise((resolve) => {
              const step = (now) => {
                if (started === null) {
                  started = now;
                  previous = now;
                } else {
                  frameDeltas.push(now - previous);
                  previous = now;
                }
                const progress = Math.min(1, (now - started) / duration);
                const triangle = progress < .5 ? progress * 2 : (1 - progress) * 2;
                controlsScroll.scrollTop = triangle * maxScroll;
                if (progress < 1) requestAnimationFrame(step);
                else resolve();
              };
              requestAnimationFrame(step);
            });
          }
          observer?.disconnect();
          if (advanced) advanced.open = false;
          controlsScroll.scrollTop = 0;
          const sortedFrames = frameDeltas.slice().sort((a, b) => a - b);
          const p95FrameMs = sortedFrames.length ? sortedFrames[Math.floor(sortedFrames.length * .95)] : 0;
          const maxFrameMs = sortedFrames.length ? Math.max(...sortedFrames) : 0;
          const longFrameCount = frameDeltas.filter(ms => ms > 100).length;
          const scrollPerformancePassed = p95FrameMs <= 34
            && maxFrameMs <= 500
            && longFrameCount <= 1
            && layoutShift <= .001;

          const noDocumentScroll = doc.scrollHeight <= doc.clientHeight + 1 && doc.scrollWidth <= doc.clientWidth + 1;
          const noEnhanceScroll = enhance.scrollHeight <= enhance.clientHeight + 1 && enhance.scrollWidth <= enhance.clientWidth + 1;
          const noPreviewScroll = preview.scrollHeight <= preview.clientHeight + 1 && preview.scrollWidth <= preview.clientWidth + 1;
          const noDropScroll = drop.scrollHeight <= drop.clientHeight + 1 && drop.scrollWidth <= drop.clientWidth + 1;
          const controlsInternalScroll = getComputedStyle(controlsScroll).overflowY === 'auto';
          const controlsInsideSidebar = sidebar.contains(controls);
          // UI v10 intentionally widened the full rail + controls sidebar to 396 px
          // at the 1366 px release-probe viewport. Validate the rendered width
          // against the active CSS design token instead of the obsolete v9
          // hard-coded 320..380 px range. This still rejects collapsed, clipped
          // or unexpectedly oversized sidebars while remaining aligned with the
          // responsive 370/348 px variants declared by the stylesheet.
          const declaredSidebarWidth = Number.parseFloat(
            getComputedStyle(doc).getPropertyValue('--sidebar-width')
          );
          const sidebarReadableWidth = Number.isFinite(declaredSidebarWidth)
            && Math.abs(sidebarBox.width - declaredSidebarWidth) <= 2
            && sidebarBox.width >= 340
            && sidebarBox.width <= 410;
          const previewUsesRemainingWidth = previewBox.width >= innerWidth - sidebarBox.width - 4;
          const readableBaseType = parseFloat(getComputedStyle(doc).fontSize) >= 14;
          // The collapse handle is docked inside the sidebar edge. Gate the
          // user-scrollable content areas so decorative controls never mask
          // real horizontal overflow in the workflow panel.
          const sidebarNoHorizontalScroll = controls.scrollWidth <= controls.clientWidth + 1
            && controlsScroll.scrollWidth <= controlsScroll.clientWidth + 1;
          const enhanceTopbarHidden = getComputedStyle(topbar).display === 'none';
          const toastAvoidsHardware = !rectsOverlap(toastBox, hardwareBox);
          const checks = {
            noDocumentScroll,
            noEnhanceScroll,
            noPreviewScroll,
            noDropScroll,
            controlsInternalScroll,
            controlsInsideSidebar,
            sidebarReadableWidth,
            previewUsesRemainingWidth,
            readableBaseType,
            sidebarNoHorizontalScroll,
            enhanceTopbarHidden,
            toastAvoidsHardware,
            primaryWorkflowReachable,
            clipboardPreviewPassed,
            scrollPerformancePassed
          };
          const failedChecks = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
          return {
            viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
            document: docBox,
            sidebar: sidebarBox,
            enhance: box('#view-enhance'),
            workspace: box('.workspace-grid'),
            preview: previewBox,
            dropZone: box('#drop-zone'),
            controls: box('.enhance-workflow'),
            controlsScroll: box('.controls-scroll'),
            primaryWorkflow: {
              startButton: box('#start-button'),
              sourcePicker: box('#sidebar-select-file-button')
            },
            hardware: hardwareBox,
            toast: toastBox,
            clipboardPreviewPath,
            clipboardDebug,
            failedChecks,
            computed: {
              rootFontSize: getComputedStyle(doc).fontSize,
              sidebarDeclaredWidth: getComputedStyle(doc).getPropertyValue('--sidebar-width').trim(),
              controlsOverflowY: getComputedStyle(controlsScroll).overflowY,
              bodyLayout: document.body.dataset.layout || '',
              uiRevision: document.body.dataset.uiRevision || ''
            },
            performance: {
              frames: frameDeltas.length,
              p95FrameMs,
              maxFrameMs,
              longFrameCount,
              layoutShift,
              maxScroll
            },
            checks,
            passed: failedChecks.length === 0
          };
        })()`);
        clipboardPreviewPath = String(metrics.clipboardPreviewPath || '');
        const screenshotPath = uiProbe.replace(/\.json$/i, ".png");
        try {
          const image = await mainWindow.webContents.capturePage();
          await fsp.writeFile(screenshotPath, image.toPNG());
        } catch (captureError) {
          metrics.screenshotError = cleanError(captureError);
        }
        writeProbeJson(uiProbe, {
          product: "Avelune Enhance",
          displayVersion: APP_DISPLAY_VERSION,
          packaged: app.isPackaged,
          screenshotPath,
          metrics
        });
        if (clipboardPreviewPath && path.isAbsolute(clipboardPreviewPath)) {
          await fsp.rm(clipboardPreviewPath, { force: true }).catch(() => {});
        }
        app.exit(metrics.passed ? 0 : 24);
      } catch (error) {
        if (clipboardPreviewPath && path.isAbsolute(clipboardPreviewPath)) {
          await fsp.rm(clipboardPreviewPath, { force: true }).catch(() => {});
        }
        logLine("ERROR", `UI probe failed: ${cleanError(error)}`);
        app.exit(23);
      }
    });
  }
}

const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.quit();else{
  app.on("second-instance",()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
  app.whenReady().then(async()=>{app.setAppUserModelId("studio.avelune.enhance");const probePath=runtimeProbePath();if(probePath){try{writeRuntimeProbe(probePath);app.exit(0);}catch(error){logLine("ERROR",`Runtime probe failed: ${cleanError(error)}`);app.exit(20);}return;}const uiProbe=uiProbePath();loadSettings();session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));session.defaultSession.setPermissionCheckHandler(()=>false);registerIpc();createWindow({uiProbe,probeSize:probeWindowSize()});const resources=resourcePaths(app,app.isPackaged);if(uiProbe){
    // UI probes measure clipboard-paste and scroll-frame timing against tight
    // budgets and never run a real enhance job, so integrityReady is never
    // awaited here (see the single `await integrityReady` above, gating job
    // start only). Racing the packaged resource integrity hash (real SHA-256
    // work across every model/binary) against that narrow measurement window
    // was starving the renderer of main-process attention and produced
    // spurious clipboard/scroll probe failures with no functional benefit.
    // Real (non-probe) launches verify exactly as before.
  }else{integrityReady=verifyAllPackagedResources(resources.root).then((count)=>{logLine("INFO",`Verified ${count} packaged resources.`);return count;}).catch((error)=>{logLine("ERROR",`Resource integrity preflight failed: ${cleanError(error)}`);throw error;});integrityReady.catch((error)=>{dialog.showErrorBox("Avelune Enhance",cleanError(error));});initializeUpdater({app,logLine});}});
  app.on("window-all-closed",()=>app.quit());
  app.on("before-quit",()=>{jobManager.cancelAll();});
}
