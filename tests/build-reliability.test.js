"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const root=path.resolve(__dirname,"..");
const builder=fs.readFileSync(path.join(root,"tools","build-rc6-release.ps1"),"utf8");
const modelFetcher=fs.readFileSync(path.join(root,"tools","fetch-official-models.ps1"),"utf8");
const nativeSourceBuilder=fs.readFileSync(path.join(root,"tools","build-native-source-archive.ps1"),"utf8");
const windowsWorkflow=fs.readFileSync(path.join(root,".github","workflows","build-windows-v2.yml"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));

test("RC6 retries only recognized transient Windows file locks",()=>{
  assert.match(builder,/function Invoke-ReleaseBuildWithRetry/);
  assert.match(builder,/MaxAttempts = 3/);
  assert.match(builder,/EBUSY\|resource busy or locked\|being used by another process/);
  assert.match(builder,/The error is not a recognized transient Windows file lock/);
});

test("RC6 waits for exclusive access and cleans partial dist safely",()=>{
  assert.match(builder,/function Test-FileUnlocked/);
  assert.match(builder,/FileShare\]::None/);
  assert.match(builder,/function Wait-FileUnlocked/);
  assert.match(builder,/function Remove-DirectoryReliable/);
  assert.match(builder,/Remove-DirectoryReliable \$Dist/);
  assert.match(builder,/Remove-DirectoryReliable \$OutputRoot/);
  assert.match(builder,/Invoke-ReleaseBuildWithRetry \$tools\.Npm 3/);
  assert.match(builder,/\$ErrorActionPreference = "Continue"/);
  assert.match(builder,/\$ErrorActionPreference = \$previousErrorActionPreference/);
});

test("build recovery does not weaken security or terminate unrelated Electron apps",()=>{
  assert.match(builder,/Where-Object \{ \[string\]\$_\.Name -like "Avelune\*\.exe" \}/);
  assert.match(builder,/StartsWith\(\$distPrefix, \[System\.StringComparison\]::OrdinalIgnoreCase\)/);
  assert.doesNotMatch(builder,/Set-MpPreference|Add-MpPreference|DisableRealtimeMonitoring/);
  assert.doesNotMatch(builder,/Get-Process\s+electron|Stop-Process[^\r\n]+electron/i);
  assert.equal(pkg.build.electronFuses.enableEmbeddedAsarIntegrityValidation,true);
  assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar,true);
});

test("release success remains gated by packaged startup UI and engine probes",()=>{
  const retryIndex=builder.indexOf("Invoke-ReleaseBuildWithRetry");
  const runtimeIndex=builder.indexOf("Packaged application startup probe passed");
  const uiIndex=builder.indexOf("Packaged UI probe passed:");
  const engineIndex=builder.indexOf("Packaged native engine smoke test passed");
  const successIndex=builder.lastIndexOf("Success = $true");
  assert.ok(retryIndex>=0 && runtimeIndex>retryIndex && uiIndex>runtimeIndex && engineIndex>uiIndex && successIndex>engineIndex);
});

test("PowerShell build scripts hash files without Get-FileHash dependency",()=>{
  for (const script of [builder, modelFetcher, nativeSourceBuilder, windowsWorkflow]) {
    assert.doesNotMatch(script,/Get-FileHash/);
    assert.match(script,/System\.Security\.Cryptography\.SHA256/);
    assert.match(script,/ComputeHash/);
  }
});
