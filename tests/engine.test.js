"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {
  buildArgs,
  modelNativeScale,
  outputName,
  sanitizeEngineDiagnostic,
  progressFromEngineChunk
} = require("../src/engine");

test("detects native model scale", () => {
  assert.equal(modelNativeScale("anime-x2"), 2);
  assert.equal(modelNativeScale("anime-3x"), 3);
  assert.equal(modelNativeScale("standard"), 4);
});

test("second pass can preserve target width", () => {
  const args = buildArgs({
    input: "in.png", output: "out.png", modelsPath: "models", model: "standard-4x",
    payload: { useCustomWidth: false, scale: "4", gpuId: "", saveImageAs: "png", compression: 90, tileSize: 0, ttaMode: false },
    forceWidth: 4096
  });
  assert.deepEqual(args.slice(args.indexOf("-w"), args.indexOf("-w") + 2), ["-w", "4096"]);
});

test("output name is deterministic and sanitized", () => {
  const name = outputName(path.join("C:\\", "bad:name.png"), { useCustomWidth: false, scale: "4", model: "avelune-standard-4x", saveImageAs: "png" });
  assert.equal(name, "bad_name_avelune_4x_avelune-standard-4x.png");
});


test("native engine branding is cleaned from diagnostics", () => {
  assert.equal(
    sanitizeEngineDiagnostic(" Upscayled Successfully!"),
    "Avelune Successfully!"
  );
  assert.doesNotMatch(sanitizeEngineDiagnostic("upscayl-bin"), /upscayl/i);
});

test("progress parser emits percentages but suppresses native branding", () => {
  const updates = progressFromEngineChunk(Buffer.from("0,00%\r100.00%\r Upscayled Successfully!\n", "latin1"));
  assert.deepEqual(updates, ["0%\n", "100%\n"]);
});
