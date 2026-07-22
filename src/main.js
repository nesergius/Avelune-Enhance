"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell, session } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { CHANNELS } = require("./constants");
const {
  validateSinglePayload,
  validateBatchPayload,
  validateClipboardPayload,
  existingDirectory,
  absolutePath,
  modelFilesExist,
  safeModelId
} = require("./validators");
const { getImageInfo } = require("./image-info");
const { verifyPackagedResource } = require("./integrity");
const { JobManager } = require("./job-manager");
const { processSingle, processBatch, resourcePaths } = require("./engine");
const { initializeUpdater } = require("./updater");

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const portableData = path.join(process.env.PORTABLE_EXECUTABLE_DIR, "AveluneData");
  fs.mkdirSync(portableData, { recursive: true });
  app.setPath("userData", portableData);
  app.setPath("logs", path.join(portableData, "logs"));
}

let mainWindow = null;
let customModelsPath = null;
const jobManager = new JobManager({ maxQueued: 16 });
const isDevelopment = !app.isPackaged;
const APP_DISPLAY_VERSION = "2.0.0 RC4";
const BUILD_VERSION = "2.0.0.4";

function userSettingsPath() {
  return path.join(app.getPath("userData"), "secure-settings.json");
}

function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(userSettingsPath(), "utf8"));
    if (parsed && typeof parsed.customModelsPath === "string" && fs.existsSync(parsed.customModelsPath)) {
      customModelsPath = parsed.customModelsPath;
    }
  } catch {}
}

function saveSettings() {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    const temp = `${userSettingsPath()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ customModelsPath }, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temp, userSettingsPath());
  } catch {}
}

function isTrustedEvent(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.sender.isDestroyed()) return false;
  const url = event.senderFrame?.url || event.sender.getURL();
  return url.startsWith("file:") && url.endsWith("/renderer/out/index.html");
}

function requireTrustedEvent(event) {
  if (!isTrustedEvent(event)) throw new Error("Недоверенный IPC-запрос заблокирован.");
}

function safeSend(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function cleanError(error) {
  const raw = error instanceof Error ? error.message : String(error || "Неизвестная ошибка");
  return raw.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\r\n]+/g, " ").slice(0, 1200);
}

function logLine(level, message) {
  try {
    const dir = app.getPath("logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "avelune.log"), `${new Date().toISOString()} [${level}] ${message}\n`, "utf8");
  } catch {}
}

function listModels(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory, { withFileTypes: true });
  const params = new Set(files.filter((entry) => entry.isFile() && entry.name.endsWith(".param")).map((entry) => entry.name.slice(0, -6)));
  const bins = new Set(files.filter((entry) => entry.isFile() && entry.name.endsWith(".bin")).map((entry) => entry.name.slice(0, -4)));
  return [...params].filter((id) => bins.has(id) && /^[A-Za-z0-9._-]+$/.test(id)).sort();
}

function notifyError(error) {
  const message = cleanError(error);
  logLine("ERROR", message);
  safeSend(CHANNELS.AVELUNE_ERROR, message);
}

function progressSender(channel) {
  return (text) => {
    const value = String(text || "");
    safeSend(channel, value);
    if (/resiz/i.test(value)) safeSend(CHANNELS.SCALING_AND_CONVERTING);
  };
}

function registerJob(channel, type, payload, runner, doneChannel) {
  try {
    const id = jobManager.enqueue(type, async ({ signal }) => {
      try {
        const result = await runner(signal);
        if (!signal.aborted) safeSend(doneChannel, result);
      } catch (error) {
        if (!signal.aborted) notifyError(error);
      }
    });
    logLine("INFO", `Queued ${type} job ${id} from ${channel}`);
  } catch (error) {
    notifyError(error);
  }
}


function runJsonExecutable(filePath, timeoutMs = 10000) {
  return new Promise((resolve) => {
    execFile(filePath, [], {
      windowsHide: true,
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: cleanError(stderr || error.message) });
        return;
      }
      try {
        resolve({ ok: true, value: JSON.parse(String(stdout || "").trim()) });
      } catch (parseError) {
        resolve({ ok: false, error: cleanError(parseError) });
      }
    });
  });
}

async function getGpuAdapters(resources) {
  if (process.platform !== "win32" || !fs.existsSync(resources.gpuInfo)) return [];
  try {
    verifyPackagedResource(resources.root, path.join("bin", "avelune-gpu-info.exe"));
  } catch (error) {
    logLine("WARN", cleanError(error));
    return [];
  }
  const result = await runJsonExecutable(resources.gpuInfo);
  if (!result.ok || !Array.isArray(result.value?.adapters)) {
    if (result.error) logLine("WARN", `DXGI diagnostics: ${result.error}`);
    return [];
  }
  return result.value.adapters
    .filter((adapter) => adapter && typeof adapter.name === "string")
    .map((adapter) => ({
      index: Number(adapter.index) || 0,
      name: adapter.name,
      vendorId: Number(adapter.vendorId) || 0,
      deviceId: Number(adapter.deviceId) || 0,
      dedicatedVideoMemoryBytes: Number(adapter.dedicatedVideoMemoryBytes) || 0,
      sharedSystemMemoryBytes: Number(adapter.sharedSystemMemoryBytes) || 0,
      softwareAdapter: Boolean(adapter.softwareAdapter)
    }));
}

function registerIpc() {
  ipcMain.handle(CHANNELS.SELECT_FILE, async (event) => {
    requireTrustedEvent(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Выберите изображение",
      properties: ["openFile"],
      filters: [{ name: "Изображения", extensions: ["png", "jpg", "jpeg", "jfif", "webp"] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(CHANNELS.SELECT_FOLDER, async (event) => {
    requireTrustedEvent(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Выберите папку",
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(CHANNELS.SELECT_CUSTOM_MODEL_FOLDER, async (event) => {
    requireTrustedEvent(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Выберите папку пользовательских AI-моделей",
      properties: ["openDirectory"]
    });
    if (result.canceled) return null;
    const selected = existingDirectory(result.filePaths[0], "Папка моделей");
    const models = listModels(selected);
    if (models.length === 0) throw new Error("В папке не найдено ни одной пары файлов .bin и .param.");
    customModelsPath = selected;
    saveSettings();
    safeSend(CHANNELS.CUSTOM_MODEL_FILES_LIST, models);
    return selected;
  });

  ipcMain.on(CHANNELS.GET_MODELS_LIST, (event) => {
    try {
      requireTrustedEvent(event);
      safeSend(CHANNELS.CUSTOM_MODEL_FILES_LIST, listModels(customModelsPath));
    } catch (error) {
      notifyError(error);
    }
  });

  ipcMain.on(CHANNELS.AVELUNE, (event, rawPayload) => {
    try {
      requireTrustedEvent(event);
      const payload = validateSinglePayload(rawPayload);
      registerJob(CHANNELS.AVELUNE, "single", payload, (signal) => processSingle({
        app,
        isPackaged: app.isPackaged,
        payload,
        customModelsPath,
        signal,
        doublePass: false,
        onProgress: progressSender(CHANNELS.AVELUNE_PROGRESS)
      }), CHANNELS.AVELUNE_DONE);
    } catch (error) { notifyError(error); }
  });

  ipcMain.on(CHANNELS.DOUBLE_AVELUNE, (event, rawPayload) => {
    try {
      requireTrustedEvent(event);
      const payload = validateSinglePayload(rawPayload);
      registerJob(CHANNELS.DOUBLE_AVELUNE, "double", payload, (signal) => processSingle({
        app,
        isPackaged: app.isPackaged,
        payload,
        customModelsPath,
        signal,
        doublePass: true,
        onProgress: progressSender(CHANNELS.DOUBLE_AVELUNE_PROGRESS)
      }), CHANNELS.DOUBLE_AVELUNE_DONE);
    } catch (error) { notifyError(error); }
  });

  ipcMain.on(CHANNELS.FOLDER_AVELUNE, (event, rawPayload) => {
    try {
      requireTrustedEvent(event);
      const payload = validateBatchPayload(rawPayload);
      registerJob(CHANNELS.FOLDER_AVELUNE, "batch", payload, (signal) => processBatch({
        app,
        isPackaged: app.isPackaged,
        payload,
        customModelsPath,
        signal,
        onProgress: progressSender(CHANNELS.FOLDER_AVELUNE_PROGRESS)
      }), CHANNELS.FOLDER_AVELUNE_DONE);
    } catch (error) { notifyError(error); }
  });

  ipcMain.on(CHANNELS.STOP, (event) => {
    try {
      requireTrustedEvent(event);
      jobManager.cancelCurrent();
      jobManager.clearQueued();
    } catch (error) { notifyError(error); }
  });

  ipcMain.on(CHANNELS.OPEN_FOLDER, async (event, rawPath) => {
    try {
      requireTrustedEvent(event);
      const target = absolutePath(rawPath, "Путь");
      if (!fs.existsSync(target)) throw new Error("Указанный путь больше не существует.");
      const error = await shell.openPath(target);
      if (error) throw new Error(error);
    } catch (error) { notifyError(error); }
  });

  ipcMain.on(CHANNELS.PASTE_IMAGE, (event, rawPayload) => {
    try {
      requireTrustedEvent(event);
      const payload = validateClipboardPayload(rawPayload);
      const directory = payload.outputPath || app.getPath("pictures");
      fs.mkdirSync(directory, { recursive: true });
      const target = path.join(directory, `avelune-clipboard-${crypto.randomUUID()}.${payload.extension}`);
      fs.writeFileSync(target, payload.buffer, { flag: "wx", mode: 0o600 });
      try {
        getImageInfo(target);
      } catch (error) {
        fs.rmSync(target, { force: true });
        throw error;
      }
      safeSend(CHANNELS.PASTE_IMAGE_SAVE_SUCCESS, target);
    } catch (error) {
      safeSend(CHANNELS.PASTE_IMAGE_SAVE_ERROR, cleanError(error));
    }
  });

  ipcMain.handle(CHANNELS.GET_SYSTEM_INFO, async (event) => {
    requireTrustedEvent(event);
    const resources = resourcePaths(app, app.isPackaged);
    const [gpuInfo, adapters] = await Promise.all([
      app.getGPUInfo("complete").catch(() => null),
      getGpuAdapters(resources)
    ]);
    const active = adapters.find((adapter) => !adapter.softwareAdapter && adapter.dedicatedVideoMemoryBytes > 0)
      || adapters.find((adapter) => !adapter.softwareAdapter)
      || null;
    const chromiumDevice = gpuInfo?.gpuDevice?.[0] || gpuInfo?.gpuDevice?.active || null;
    return {
      platform: process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux",
      release: os.release(),
      model: os.cpus()[0]?.model || "—",
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      gpu: {
        deviceString: active?.name || chromiumDevice?.deviceString || chromiumDevice?.vendorString || "GPU с поддержкой Vulkan",
        vendorString: chromiumDevice?.vendorString || "",
        dedicatedVideoMemoryBytes: active?.dedicatedVideoMemoryBytes || 0
      },
      adapters
    };
  });

  ipcMain.handle(CHANNELS.GET_APP_VERSION, (event) => {
    requireTrustedEvent(event);
    return `v${APP_DISPLAY_VERSION}`;
  });

  ipcMain.handle(CHANNELS.GET_DIAGNOSTICS, async (event) => {
    requireTrustedEvent(event);
    const resources = resourcePaths(app, app.isPackaged);
    const adapters = await getGpuAdapters(resources);
    return {
      version: app.getVersion(),
      displayVersion: APP_DISPLAY_VERSION,
      buildVersion: BUILD_VERSION,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      cpu: os.cpus()[0]?.model || "",
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      gpuAdapters: adapters,
      dedicatedVideoMemoryBytes: Math.max(0, ...adapters.map((adapter) => adapter.dedicatedVideoMemoryBytes || 0)),
      enginePresent: fs.existsSync(resources.engine),
      gpuInfoHelperPresent: fs.existsSync(resources.gpuInfo),
      modelsPresent: fs.existsSync(resources.models),
      jobManager: jobManager.getStatus()
    };
  });
}

function runtimeProbePath() {
  const prefix = "--avelune-runtime-probe=";
  const raw = process.argv.find((argument) => String(argument).startsWith(prefix));
  if (!raw) return null;
  const candidate = path.normalize(String(raw).slice(prefix.length));
  if (!path.isAbsolute(candidate) || candidate.includes("\0")) return null;
  return candidate;
}

function writeRuntimeProbe(targetPath) {
  const payload = {
    product: "Avelune Enhance",
    displayVersion: APP_DISPLAY_VERSION,
    appVersion: app.getVersion(),
    buildVersion: BUILD_VERSION,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  };
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, targetPath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 860,
    minHeight: 660,
    show: false,
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
      devTools: isDevelopment
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "out", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("studio.avelune.enhance");
    const probePath = runtimeProbePath();
    if (probePath) {
      try {
        writeRuntimeProbe(probePath);
        app.exit(0);
      } catch (error) {
        logLine("ERROR", `Runtime probe failed: ${cleanError(error)}`);
        app.exit(20);
      }
      return;
    }
    loadSettings();
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    registerIpc();
    createWindow();
    initializeUpdater({ app, logLine });
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    jobManager.cancelCurrent();
    jobManager.clearQueued();
  });
}
