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
  GET_DIAGNOSTICS: "avelune:get-diagnostics"
});

const SEND_CHANNELS = new Set([
  CHANNELS.AVELUNE,
  CHANNELS.DOUBLE_AVELUNE,
  CHANNELS.FOLDER_AVELUNE,
  CHANNELS.OPEN_FOLDER,
  CHANNELS.GET_MODELS_LIST,
  CHANNELS.STOP,
  CHANNELS.PASTE_IMAGE
]);

const INVOKE_CHANNELS = new Set([
  CHANNELS.SELECT_FILE,
  CHANNELS.SELECT_FOLDER,
  CHANNELS.SELECT_CUSTOM_MODEL_FOLDER,
  CHANNELS.GET_SYSTEM_INFO,
  CHANNELS.GET_APP_VERSION,
  CHANNELS.GET_DIAGNOSTICS
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
  CHANNELS.PASTE_IMAGE_SAVE_ERROR
]);

const BUILTIN_MODELS = Object.freeze([
  "avelune-standard-4x",
  "avelune-lite-4x",
  "high-fidelity-4x",
  "remacri-4x",
  "ultramix-balanced-4x",
  "ultrasharp-4x",
  "digital-art-4x"
]);

const IMAGE_EXTENSIONS = Object.freeze(["png", "jpg", "jpeg", "jfif", "webp"]);
const OUTPUT_FORMATS = Object.freeze(["png", "jpg", "jpeg", "webp"]);

module.exports = {
  CHANNELS,
  SEND_CHANNELS,
  INVOKE_CHANNELS,
  RECEIVE_CHANNELS,
  BUILTIN_MODELS,
  IMAGE_EXTENSIONS,
  OUTPUT_FORMATS
};
