"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const builder = fs.readFileSync(
  path.join(root, "tools", "build-rc5-2-release.ps1"),
  "utf8"
);

test("captured electron-builder output cannot contaminate the numeric exit code", () => {
  assert.match(builder, /function Invoke-ExternalCaptured/);
  assert.match(
    builder,
    /2>&1\s*\|\s*ForEach-Object\s*\{[\s\S]*?Add-Content[\s\S]*?Write-Host[\s\S]*?\}\s*\|\s*Out-Null/
  );
  assert.match(builder, /\$exitCode = \[int\]\$LASTEXITCODE/);
  assert.match(builder, /return \$exitCode/);
  assert.doesNotMatch(
    builder,
    /Tee-Object -FilePath \$CapturePath -Append\s*(?:\r?\n)\s*\$exitCode/
  );
});

test("release retry validates that capture returns exactly one integer", () => {
  assert.match(builder, /\$captureResult = @\(Invoke-ExternalCaptured/);
  assert.match(builder, /\$captureResult\.Count -ne 1/);
  assert.match(builder, /\$exitCode = \[int\]\$captureResult\[0\]/);
  assert.match(builder, /Build capture returned a non-numeric exit code/);
});

test("a zero native exit code advances to packaged runtime probes", () => {
  const zeroIndex = builder.indexOf("if ($exitCode -eq 0)");
  const returnIndex = builder.indexOf(
    'Write-Log ("electron-builder completed on attempt $attempt.")'
  );
  const startupIndex = builder.indexOf(
    "Packaged application startup probe passed"
  );
  assert.ok(zeroIndex >= 0);
  assert.ok(returnIndex > zeroIndex);
  assert.ok(startupIndex > returnIndex);
});
