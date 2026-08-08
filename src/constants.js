"use strict";

const CHANNELS = Object.freeze({
  SELECT_FILE: "Select a File",
  SELECT_FOLDER: "Select a Folder",
  AVELUNE: "Upscale the Image",
  AVELUNE_DONE: "Upscaling Done",
  AVELUNE_PROGRESS: "Send Progress from Main to Renderer",
  DOUBLE_AVELUNE: "Double Upscale the Image",
  DOUBLE_AVELUNE_DONE: "Double Upscaling Done",
  DOUBLE_AVELUNE_PROGRESS: "Send Double Avelune Progress from Main to Renderer",
  FOLDER_AVELUNE: "Upscale a Folder",
  FOLDER_AVELUNE_DONE: "Folder upscaling successful",
  FOLDER_AVELUNE_PROGRESS: "Send Folder Upscaling Progress from Main to Renderer",
  OPEN_FOLDER: "Open Folder",
  SELECT_CUSTOM_MODEL_FOLDER: "Select a Custom Model Folder",
  GET_MODELS_LIST: "Send models list from main to renderer",
  CUSTOM_MODEL_FILES_LIST: "Send custom model files list to renderer",
  STOP: "Stop the current operation",
  SCALING_AND_CONVERTING: "Adding some finishing touches",
  AVELUNE_ERROR: "Upscaling Error",
  PASTE_IMAGE: "Paste Image from clipboard",
  PASTE_IMAGE_SAVE_SUCCESS: "Clipboard Image saved successfully",
  PASTE_IMAGE_SAVE_ERROR: "Clipboard Image save failed",
  GET_SYSTEM_INFO: "avelune:get-system-info",
  GET_APP_VERSION: "avelune:get-app-version",
  GET_DIAGNOSTICS: "avelune:get-diagnostics",
  GET_IMAGE_PREVIEW: "avelune:get-image-preview",
  SCAN_BATCH_FOLDER: "avelune:scan-batch-folder",
  PAUSE_BATCH: "avelune:pause-batch",
  RESUME_BATCH: "avelune:resume-batch",
  BATCH_ITEM_EVENT: "avelune:batch-item-event",
  RUN_GPU_BENCHMARK: "avelune:run-gpu-benchmark",
  GET_QUEUE_STATUS: "avelune:get-queue-status",
  GET_CLOUD_SETTINGS: "avelune:get-cloud-settings",
  SAVE_CLOUD_SETTINGS: "avelune:save-cloud-settings"
});

const SEND_CHANNELS = new Set([
  CHANNELS.AVELUNE,
  CHANNELS.DOUBLE_AVELUNE,
  CHANNELS.FOLDER_AVELUNE,
  CHANNELS.OPEN_FOLDER,
  CHANNELS.GET_MODELS_LIST,
  CHANNELS.STOP,
  CHANNELS.PASTE_IMAGE,
  CHANNELS.PAUSE_BATCH,
  CHANNELS.RESUME_BATCH
]);

const INVOKE_CHANNELS = new Set([
  CHANNELS.SELECT_FILE,
  CHANNELS.SELECT_FOLDER,
  CHANNELS.SELECT_CUSTOM_MODEL_FOLDER,
  CHANNELS.GET_SYSTEM_INFO,
  CHANNELS.GET_APP_VERSION,
  CHANNELS.GET_DIAGNOSTICS,
  CHANNELS.GET_IMAGE_PREVIEW,
  CHANNELS.SCAN_BATCH_FOLDER,
  CHANNELS.RUN_GPU_BENCHMARK,
  CHANNELS.GET_QUEUE_STATUS,
  CHANNELS.GET_CLOUD_SETTINGS,
  CHANNELS.SAVE_CLOUD_SETTINGS
]);

const RECEIVE_CHANNELS = new Set([
  CHANNELS.AVELUNE_DONE,
  CHANNELS.AVELUNE_PROGRESS,
  CHANNELS.DOUBLE_AVELUNE_DONE,
  CHANNELS.DOUBLE_AVELUNE_PROGRESS,
  CHANNELS.FOLDER_AVELUNE_DONE,
  CHANNELS.FOLDER_AVELUNE_PROGRESS,
  CHANNELS.CUSTOM_MODEL_FILES_LIST,
  CHANNELS.SCALING_AND_CONVERTING,
  CHANNELS.AVELUNE_ERROR,
  CHANNELS.PASTE_IMAGE_SAVE_SUCCESS,
  CHANNELS.PASTE_IMAGE_SAVE_ERROR,
  CHANNELS.BATCH_ITEM_EVENT
]);

const BUILTIN_MODELS = Object.freeze([
  "avelune-standard-4x",
  "digital-art-4x",
  "realesrnet-x4plus",
  "realesr-animevideov3-x2",
  "realesr-animevideov3-x3",
  "realesr-animevideov3-x4"
]);

const IMAGE_EXTENSIONS = Object.freeze(["png", "jpg", "jpeg", "jfif", "webp"]);
const OUTPUT_FORMATS = Object.freeze(["png", "jpg", "jpeg", "webp"]);
const JOB_TYPES = Object.freeze(["single", "double", "batch"]);

module.exports = {
  CHANNELS,
  SEND_CHANNELS,
  INVOKE_CHANNELS,
  RECEIVE_CHANNELS,
  BUILTIN_MODELS,
  IMAGE_EXTENSIONS,
  OUTPUT_FORMATS,
  JOB_TYPES
};
