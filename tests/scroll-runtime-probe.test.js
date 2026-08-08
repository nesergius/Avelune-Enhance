"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(
  path.join(root, "renderer", "out", "assets", "app.css"),
  "utf8"
);
const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const builder = fs.readFileSync(
  path.join(root, "tools", "build-rc6-release.ps1"),
  "utf8"
);

test("RC6 keeps the document fixed while allowing intentional controls scrolling", () => {
  assert.match(main, /primaryWorkflowReachable/);
  assert.match(main, /controls\.contains\(startButton\)/);
  assert.match(main, /controlsScroll\.contains\(sourcePicker\)/);
  assert.match(main, /isViewportReachable\(startButton\)/);
  assert.match(main, /isViewportReachable\(sourcePicker\)/);
  assert.doesNotMatch(main, /controlsScroll\.contains\(startButton\)/);
  assert.match(main, /controlsInternalScroll/);
  assert.match(main, /failedChecks\.length === 0/);
  assert.doesNotMatch(main, /defaultControlsNoScroll/);
});

test("packaged probe measures scroll frame pacing and layout stability", () => {
  assert.match(main, /app\.disableHardwareAcceleration\(\)/);
  assert.match(main, /safeAbsoluteArgument\("--avelune-ui-probe="\)/);
  assert.match(main, /PerformanceObserver/);
  assert.match(main, /p95FrameMs <= 34/);
  assert.match(main, /maxFrameMs <= 500/);
  assert.match(main, /longFrameCount <= 1/);
  assert.match(main, /layoutShift <= \.001/);
  assert.match(main, /scrollPerformancePassed/);
  assert.match(builder, /p95FrameMs=\$\(\$perf\.p95FrameMs\)/);
  assert.match(builder, /longFrameCount=\$\(\$perf\.longFrameCount\)/);
  assert.match(builder, /layoutShift=\$\(\$perf\.layoutShift\)/);
  assert.match(builder, /PackagedScrollPerformanceProbePassed = \$true/);
  assert.match(builder, /PackagedUiProbeMatrixPassed = \$true/);
  assert.match(builder, /1366x768-125/);
  assert.match(builder, /1920x1080-150/);
  assert.match(main, /capturePage\(\)/);
});

test("normal windows are throttled in background and sidebar uses native scrolling", () => {
  assert.match(main, /backgroundThrottling: uiProbe \? false : true/);
  assert.match(css, /\.controls-scroll \{[\s\S]*?overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.doesNotMatch(css, /will-change/);
  assert.doesNotMatch(css, /addEventListener\("wheel"/);
});
