"use strict";

const { autoUpdater } = require("electron-updater");

const RC_UPDATE_ENV = "AVELUNE_ENABLE_RC_UPDATES";

function isPortableProcess() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function isPrerelease(version) {
  return typeof version === "string" && version.includes("-");
}

function updatesMayRun(app) {
  if (!app || !app.isPackaged) return false;
  if (isPortableProcess()) return false;
  const prerelease = isPrerelease(app.getVersion());
  return !prerelease || process.env[RC_UPDATE_ENV] === "1";
}

function initializeUpdater({ app, logLine }) {
  const log = typeof logLine === "function" ? logLine : () => {};
  if (!updatesMayRun(app)) {
    const reason = !app?.isPackaged
      ? "development build"
      : isPortableProcess()
        ? "portable build"
        : `RC updates disabled; set ${RC_UPDATE_ENV}=1 only for closed testing`;
    log("INFO", `Automatic updates are inactive: ${reason}.`);
    return { enabled: false, reason };
  }

  const prerelease = isPrerelease(app.getVersion());
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = prerelease;
  autoUpdater.channel = prerelease ? "rc" : "latest";

  autoUpdater.on("checking-for-update", () => {
    log("INFO", `Checking the ${autoUpdater.channel} update channel.`);
  });
  autoUpdater.on("update-available", (info) => {
    log("INFO", `Update available: ${String(info?.version || "unknown")}.`);
  });
  autoUpdater.on("update-not-available", (info) => {
    log("INFO", `No update available; current channel version is ${String(info?.version || "unknown")}.`);
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Number(progress?.percent || 0).toFixed(1);
    log("INFO", `Update download: ${percent}%.`);
  });
  autoUpdater.on("update-downloaded", (info) => {
    log("INFO", `Update downloaded: ${String(info?.version || "unknown")}; installation is scheduled on exit.`);
  });
  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error || "Unknown updater error");
    log("ERROR", `Auto-update error: ${message.replace(/[\r\n]+/g, " ").slice(0, 1000)}`);
  });

  const timer = setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      const message = error instanceof Error ? error.message : String(error || "Unknown updater error");
      log("ERROR", `Update check failed: ${message.replace(/[\r\n]+/g, " ").slice(0, 1000)}`);
    });
  }, 30000);
  timer.unref?.();

  return { enabled: true, channel: autoUpdater.channel };
}

module.exports = {
  RC_UPDATE_ENV,
  isPortableProcess,
  isPrerelease,
  updatesMayRun,
  initializeUpdater
};
