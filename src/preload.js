"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { pathToFileURL } = require("url");

const SEND = new Set([
  "Upscale the Image", "Double Upscale the Image", "Upscale a Folder", "Open Folder",
  "Send models list from main to renderer", "Stop the current operation", "Paste Image from clipboard",
  "avelune:pause-batch", "avelune:resume-batch"
]);
const INVOKE = new Set([
  "Select a File",
  "Select a Folder",
  "Select a Custom Model Folder",
  "avelune:get-image-preview", "avelune:scan-batch-folder", "avelune:run-gpu-benchmark", "avelune:get-queue-status",
  "avelune:get-local-ai-status", "avelune:install-local-ai", "avelune:remove-local-ai"
]);
const RECEIVE = new Set([
  "Upscaling Done", "Send Progress from Main to Renderer", "Double Upscaling Done",
  "Send Double Avelune Progress from Main to Renderer", "Folder upscaling successful",
  "Send Folder Upscaling Progress from Main to Renderer", "Send custom model files list to renderer",
  "Adding some finishing touches", "Upscaling Error", "Clipboard Image saved successfully", "Clipboard Image save failed",
  "avelune:batch-item-event", "avelune:local-ai-progress"
]);
function checkedChannel(set, channel) {
  if (typeof channel !== "string" || !set.has(channel)) throw new Error("Blocked IPC channel");
  return channel;
}
contextBridge.exposeInMainWorld("electron", Object.freeze({
  platform: process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux",
  send(channel, payload) { ipcRenderer.send(checkedChannel(SEND, channel), payload); },
  invoke(channel, payload) { return ipcRenderer.invoke(checkedChannel(INVOKE, channel), payload); },
  on(channel, callback) {
    checkedChannel(RECEIVE, channel);
    if (typeof callback !== "function") throw new TypeError("callback must be a function");
    const listener = (_event, payload) => callback(null, payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  getSystemInfo() { return ipcRenderer.invoke("avelune:get-system-info"); },
  getAppVersion() { return ipcRenderer.invoke("avelune:get-app-version"); },
  getDiagnostics() { return ipcRenderer.invoke("avelune:get-diagnostics"); },
  getLocalAiStatus() { return ipcRenderer.invoke("avelune:get-local-ai-status"); },
  installLocalAi(backend = "auto", tier = "pro") { return ipcRenderer.invoke("avelune:install-local-ai", { backend: String(backend || "auto"), tier: String(tier || "pro") }); },
  removeLocalAi(tier = "pro") { return ipcRenderer.invoke("avelune:remove-local-ai", { tier: String(tier || "pro") }); },
  getImagePreview(filePath) {
    return ipcRenderer.invoke("avelune:get-image-preview", String(filePath || ""));
  },
  getPathForFile(file) { try { return file ? webUtils.getPathForFile(file) : ""; } catch { return ""; } },
  toFileUrl(filePath) { try { return pathToFileURL(String(filePath || "")).href; } catch { return ""; } }
}));
