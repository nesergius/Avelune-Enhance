"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  copySourceTree,
  excludedDirectory,
  excludedFile
} = require("../tools/stage-source-snapshot");

const root = path.resolve(__dirname, "..");
const builder = fs.readFileSync(
  path.join(root, "tools", "build-rc6-release.ps1"),
  "utf8"
);

test("source stager excludes every generated build and backup tree", () => {
  for (const name of [
    "node_modules",
    "dist",
    "RC5.2-OUTPUT",
    "OLD-OUTPUT",
    "QA-REPORT-20260726",
    ".qa-ultra-install",
    "gfpgan",
    "__pycache__",
    ".rc5.1-backup-before-fix",
    ".git",
    ".electron-cache"
  ]) {
    assert.equal(excludedDirectory(name), true, name);
  }
  for (const name of [
    "RC5.2-BUILD.log",
    "Avelune-Enhance-RC6-FINAL-FIXED.zip",
    "Avelune-Enhance-2.0.0-RC6-Source-Snapshot.zip",
    "package-lock.before-test",
    "module.pyc",
    "module.pyo",
    "file.tmp",
    "file.bak"
  ]) {
    assert.equal(excludedFile(name), true, name);
  }
});

test("public source tree keeps personal root Windows launchers out of main", () => {
  assert.equal(fs.existsSync(path.join(root, "BUILD_RC5_2_WINDOWS.cmd")), false);
  assert.equal(fs.existsSync(path.join(root, "BUILD_RC6_WINDOWS.cmd")), false);
  assert.equal(fs.existsSync(path.join(root, "tools", "build-rc6-release.ps1")), true);
});

test("source stager copies a complete tree without robocopy and omits generated content", async () => {
  const temporary = await fs.promises.mkdtemp(path.join(os.tmpdir(), "avelune-stage-test-"));
  const source = path.join(temporary, "source");
  const destination = path.join(temporary, "snapshot");
  const report = path.join(temporary, "report.json");

  try {
    const required = {
      "package.json": "{}",
      "package-lock.json": "{}",
      "LICENSE": "license",
      "src/main.js": "\"use strict\";",
      "renderer/out/index.html": "<!doctype html>",
      "resources/resource-manifest.json": "{\"files\":[]}"
    };
    for (const [relative, content] of Object.entries(required)) {
      const target = path.join(source, ...relative.split("/"));
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, content);
    }
    for (let index = 0; index < 24; index += 1) {
      const target = path.join(source, "docs", `file-${index}.txt`);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, "x".repeat(65536));
    }

    await fs.promises.mkdir(path.join(source, "node_modules", "bad"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "node_modules", "bad", "secret.txt"), "bad");
    await fs.promises.mkdir(path.join(source, "RC5.2-OUTPUT"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "RC5.2-OUTPUT", "artifact.exe"), "bad");
    await fs.promises.mkdir(path.join(source, ".qa-ultra-install"), { recursive: true });
    await fs.promises.writeFile(path.join(source, ".qa-ultra-install", "model.pth"), "bad");
    await fs.promises.mkdir(path.join(source, "gfpgan", "weights"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "gfpgan", "weights", "detection_Resnet50_Final.pth"), "bad");
    await fs.promises.mkdir(path.join(source, "resources", "local-ai", "__pycache__"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "resources", "local-ai", "__pycache__", "runner.pyc"), "bad");
    await fs.promises.writeFile(path.join(source, "resources", "local-ai", "runner.pyo"), "bad");
    await fs.promises.writeFile(path.join(source, "RC5.2-BUILD.log"), "bad");
    await fs.promises.writeFile(path.join(source, "Avelune-Enhance-RC6-FINAL-FIXED.zip"), "bad");

    const summary = await copySourceTree({
      source,
      destination,
      version: "2.0.0 RC5.2",
      nativeSourceComplete: true,
      report
    });

    assert.ok(summary.filesCopied >= 31);
    assert.ok(summary.bytesCopied >= 1024 * 1024);
    assert.equal(fs.existsSync(path.join(destination, "node_modules")), false);
    assert.equal(fs.existsSync(path.join(destination, "RC5.2-OUTPUT")), false);
    assert.equal(fs.existsSync(path.join(destination, ".qa-ultra-install")), false);
    assert.equal(fs.existsSync(path.join(destination, "gfpgan")), false);
    assert.equal(fs.existsSync(path.join(destination, "resources", "local-ai", "__pycache__")), false);
    assert.equal(fs.existsSync(path.join(destination, "resources", "local-ai", "runner.pyo")), false);
    assert.equal(fs.existsSync(path.join(destination, "RC5.2-BUILD.log")), false);
    assert.equal(fs.existsSync(path.join(destination, "Avelune-Enhance-RC6-FINAL-FIXED.zip")), false);
    assert.equal(fs.existsSync(path.join(destination, "SOURCE_COMPLETENESS_NOTICE.md")), true);
    assert.equal(fs.existsSync(report), true);
  } finally {
    await fs.promises.rm(temporary, { recursive: true, force: true });
  }
});

test("release builder prebuilds source snapshot before npm ci and never invokes robocopy", () => {
  assert.doesNotMatch(builder, /(?:^|\s)&?\s*robocopy(?:\s|$)/im);
  assert.match(builder, /tools\\stage-source-snapshot\.js/);
  assert.match(builder, /Source snapshot preflight passed/);
  assert.match(builder, /Prebuilt source snapshot copied into the upload package/);

  const snapshotIndex = builder.indexOf("New-SourceSnapshot $prebuiltSourceArchive");
  const npmIndex = builder.indexOf('Invoke-External $tools.Npm @(\n        "ci"');
  const releaseIndex = builder.indexOf("Invoke-ReleaseBuildWithRetry $tools.Npm 3");
  assert.ok(snapshotIndex >= 0);
  assert.ok(npmIndex > snapshotIndex);
  assert.ok(releaseIndex > npmIndex);
});

test("release builder validates source archive size and checksum after copy", () => {
  assert.match(builder, /Source snapshot archive is unexpectedly small/);
  assert.match(builder, /Copied source snapshot checksum does not match/);
  assert.match(builder, /Prebuilt source snapshot is missing/);
});
