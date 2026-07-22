"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const SEND = new Set([
  "Upscale the Image",
  "Double Upscale the Image",
  "Upscale a Folder",
  "Open Folder",
  "Send models list from main to renderer",
  "Stop the current operation",
  "Paste Image from clipboard"
]);

const INVOKE = new Set([
  "Select a File",
  "Select a Folder",
  "Select a Custom Model Folder"
]);

const RECEIVE = new Set([
  "Upscaling Done",
  "Send Progress from Main to Renderer",
  "Double Upscaling Done",
  "Send Double Avelune Progress from Main to Renderer",
  "Folder upscaling successful",
  "Send Folder Upscaling Progress from Main to Renderer",
  "Send custom model files list to renderer",
  "Adding some finishing touches",
  "Upscaling Error",
  "Clipboard Image saved successfully",
  "Clipboard Image save failed"
]);

function checkedChannel(set, channel) {
  if (typeof channel !== "string" || !set.has(channel)) {
    throw new Error("Blocked IPC channel");
  }
  return channel;
}

contextBridge.exposeInMainWorld("electron", Object.freeze({
  platform: process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux",
  send(channel, payload) {
    ipcRenderer.send(checkedChannel(SEND, channel), payload);
  },
  invoke(channel, payload) {
    return ipcRenderer.invoke(checkedChannel(INVOKE, channel), payload);
  },
  on(channel, callback) {
    checkedChannel(RECEIVE, channel);
    if (typeof callback !== "function") throw new TypeError("callback must be a function");
    const listener = (_event, payload) => callback(null, payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  getSystemInfo() {
    return ipcRenderer.invoke("avelune:get-system-info");
  },
  getAppVersion() {
    return ipcRenderer.invoke("avelune:get-app-version");
  },
  getDiagnostics() {
    return ipcRenderer.invoke("avelune:get-diagnostics");
  }
}));
