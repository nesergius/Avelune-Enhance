"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const proInstaller = read("resources/local-ai/install-local-restore.ps1");
const ultraInstaller = read("resources/local-ai/install-ultra-restore.ps1");
const localAi = read("src/local-ai.js");
const renderer = read("renderer/out/assets/app.js");

test("local AI installers normalize PowerShell progress before integer conversion", () => {
  for (const script of [proInstaller, ultraInstaller]) {
    assert.match(script, /function Normalize-Percent\s*\{/);
    assert.match(script, /param\(\[object\]\$/);
    assert.match(script, /\[object\]\$percent = 0/i);
    assert.ok(script.includes("'-?\\d+(?:[\\.,]\\d+)?'"));
    assert.match(script, /Globalization\.CultureInfo\]::InvariantCulture/);
    assert.match(script, /function Write-Stage\s*\{/);
    assert.match(script, /\[object\]\$stagePercent = 0/i);
    assert.doesNotMatch(script, /function Write-Stage\([^)]+\[int\]\$/);
    assert.match(script, /function Run\s*\{/);
    assert.match(script, /function Get-InstalledTorchBackend\s*\{/);
    assert.match(script, /--force-reinstall/);
    assert.match(script, /CUDA backend requested but CPU torch wheel is active/);
    assert.match(script, /\[object\[\]\]\$arguments = @\(\)/i);
    assert.match(script, /Command path is empty/);
    assert.match(script, /--timeout','120','--retries','5/);
    assert.match(script, /Get-Command curl\.exe/);
    assert.match(script, /--speed-time 60/);
    assert.match(script, /Invoke-WebRequest -UseBasicParsing -TimeoutSec 120/);
    assert.match(script, /Downloaded file size mismatch/);
    assert.match(script, /IO\.Compression\.ZipFile\]::OpenRead/);
    assert.match(script, /function Test-ExistingDownload/);
    assert.match(script, /minimumBytes = 32/i);
    assert.match(script, /Download failed after \$attempt attempts/);
    assert.match(script, /Real-ESRGAN\/releases\/download\/v0\.1\.0\/RealESRGAN_x4plus\.pth/);
    assert.match(script, /GFPGANv1\.4\.pth'\) 300000000/);
    assert.match(script, /RealESRGAN_x4plus\.pth'\) 60000000/);
    assert.match(script, /detection_Resnet50_Final\.pth'\) 100000000/);
    assert.match(script, /parsing_parsenet\.pth'\) 80000000/);
    assert.match(script, /GFPGAN face helper weights are missing/);
    assert.match(script, /runtimePatch\s*=?\s*3/);
    assert.match(script, /WriteAllText\(\(Join-Path \$InstallRoot 'installed\.json'\), \$.*ManifestJson, \(New-Object System\.Text\.UTF8Encoding \$false\)\)/i);
    assert.doesNotMatch(script, /Set-Content -Encoding UTF8 \(Join-Path \$InstallRoot 'installed\.json'\)/);
    assert.doesNotMatch(script, /Real-ESRGAN\/releases\/download\/v0\.2\.5\.0\/RealESRGAN_x4plus\.pth/);
    assert.doesNotMatch(script, /[\u2018\u2019\u201a\u201b\u201c\u201d\u201e]/);
  }
  assert.doesNotMatch(ultraInstaller, /function Run\(\[string\]\$Exe,\[string\[\]\]\$Args\)/);
  assert.doesNotMatch(ultraInstaller, /Run \$Python @\(/);
  assert.match(ultraInstaller, /Run -Exe \$Python -Arguments @\(/);
  assert.match(ultraInstaller, /--prefer-binary','--use-pep517','numpy==1\.26\.4','scipy==1\.12\.0','matplotlib==3\.8\.4','filterpy==1\.4\.5/);
  assert.match(ultraInstaller, /HF_HUB_DOWNLOAD_TIMEOUT = '120'/);
  assert.match(ultraInstaller, /hf_hub_download\(repo_id='lxq007\/DiffBIR-v2', filename='DiffBIR_v2\.1\.pt'/);
  assert.match(ultraInstaller, /Test-Path -LiteralPath \(Join-Path \$RepoRoot 'inference\.py'\)/);
  assert.match(ultraInstaller, /sd2\.1-base-zsnr-laionaes5\.ckpt',5000000000/);
  assert.match(ultraInstaller, /realesrgan_s4_swinir_100k\.pth',80000000/);
  assert.match(ultraInstaller, /resume_download=True/);
  assert.match(ultraInstaller, /torch==2\.1\.2','torchvision==0\.16\.2/);
  assert.match(ultraInstaller, /pandas==2\.2\.2/);
  assert.match(ultraInstaller, /ftfy==6\.2\.0/);
  assert.match(ultraInstaller, /regex==2023\.12\.25/);
  assert.match(ultraInstaller, /torchsde==0\.2\.6/);
  assert.match(ultraInstaller, /import torch, cv2, pandas, ftfy, regex, torchsde, transformers, basicsr, gfpgan, realesrgan, diffbir/);
  assert.match(ultraInstaller, /runtimePatch=3/);
});

test("local AI progress IPC accepts percent strings and keeps tier metadata", () => {
  assert.match(localAi, /function normalizePercent\(value\)/);
  assert.match(localAi, /replace\(\/\^\\uFEFF\/,""\)/);
  assert.match(localAi, /AVELUNE_STAGE:\(\[\^:\]\*\):\(\.\*\)/);
  assert.match(localAi, /percent:normalizePercent\(m\[1\]\)/);
  assert.match(localAi, /onProgress\?\.\(\{tier,percent:/);
  assert.match(localAi, /const faceWeights=\[path\.join\(f\.models,"gfpgan","weights","detection_Resnet50_Final\.pth"\),path\.join\(f\.models,"gfpgan","weights","parsing_parsenet\.pth"\)\]/);
  assert.match(localAi, /runtimePatch\|\|0\)>=3/);
});

test("local restore runners expose quality and Ultra uses full cascade", () => {
  const proRunner = read("resources/local-ai/local_restore_runner.py");
  const ultraRunner = read("resources/local-ai/ultra_restore_runner.py");
  assert.match(proRunner, /--quality/);
  assert.match(proRunner, /professional_preprocess/);
  assert.match(proRunner, /professional_finish/);
  assert.match(proRunner, /looks_graphic/);
  assert.match(proRunner, /cv2\.fastNlMeansDenoisingColored/);
  assert.match(proRunner, /cv2\.createCLAHE/);
  assert.match(proRunner, /quality_caps/);
  assert.match(proRunner, /models_dir = os\.path\.abspath\(args\.models\)/);
  assert.match(proRunner, /os\.chdir\(models_dir\)/);
  assert.match(proRunner, /detection_Resnet50_Final\.pth/);
  assert.match(ultraRunner, /env\['PYTHONPATH'\]/);
  assert.match(ultraRunner, /professional_preprocess/);
  assert.match(ultraRunner, /professional_finish/);
  assert.match(ultraRunner, /looks_graphic/);
  assert.match(ultraRunner, /cv2\.fastNlMeansDenoisingColored/);
  assert.match(ultraRunner, /cv2\.createCLAHE/);
  assert.match(ultraRunner, /runpy\.run_path\(script, run_name='__main__'\)/);
  assert.match(ultraRunner, /'faithful': \{'steps': 12/);
  assert.match(ultraRunner, /'balanced': \{'steps': 28/);
  assert.match(ultraRunner, /'maximum': \{'steps': 48/);
  assert.match(ultraRunner, /'noise': 0/);
  assert.match(ultraRunner, /AVELUNE_DIFFBIR_STEPS/);
  assert.match(ultraRunner, /max\(2, min\(settings\['steps'\], steps\)\)/);
  assert.match(ultraRunner, /apply_qa_step_override\(quality_settings\(args\.quality, args\.strength\)\)/);
  assert.match(ultraRunner, /'--strength', str\(settings\['strength'\]\)/);
  assert.match(ultraRunner, /--cleaner_tiled/);
  assert.match(ultraRunner, /--vae_decoder_tiled/);
  assert.match(ultraRunner, /--cldm_tiled/);
  assert.doesNotMatch(ultraRunner, /--tiled/);
  assert.match(ultraRunner, /should_skip_diffbir_progress/);
  assert.match(ultraRunner, /failed to import ram/);
  assert.match(ultraRunner, /setting up sdpcrossattention/);
  assert.match(ultraRunner, /runtimewarning/);
  assert.match(ultraRunner, /apply_face_restore/);
  assert.match(ultraRunner, /GFPGANer/);
  assert.match(ultraRunner, /quality_settings/);
  assert.match(ultraRunner, /args\.repo = os\.path\.abspath\(args\.repo\)/);
  assert.match(ultraRunner, /args\.models = os\.path\.abspath\(args\.models\)/);
  assert.match(ultraRunner, /os\.chdir\(models_dir\)/);
  assert.match(ultraRunner, /parsing_parsenet\.pth/);
});

test("renderer routes Pro and Ultra package progress to separate controls", () => {
  assert.match(renderer, /function normalizePercent\(value\)/);
  assert.match(renderer, /payload\?\.tier === "ultra"/);
  assert.match(renderer, /els\.ultraAiProgressBar/);
  assert.match(renderer, /els\.localAiProgressBar/);
  assert.match(renderer, /progressText\.textContent = payload\?\.message \|\| `Установка: \$\{percent\}%`/);
});

test("renderer gates downloadable restore profiles by installed package status", () => {
  assert.match(renderer, /function localRestoreTierForProfile\(profileId\)/);
  assert.match(renderer, /function isLocalAiTierInstalled\(tier\)/);
  assert.match(renderer, /function fallbackUnavailableLocalRestore\(notify = false\)/);
  assert.match(renderer, /disabled aria-disabled="true"/);
  assert.match(renderer, /packageMissing \? `Установите \$\{escapeHtml\(localAiTierLabel\(requiredTier\)\.replace\("Photo Restore ", ""\)\)\}`/);
  assert.match(renderer, /Photo Restore Pro не установлен/);
  assert.match(renderer, /if \(!fallbackUnavailableLocalRestore\(true\)\)/);
  assert.match(renderer, /const restoredFallback = !fallbackUnavailableLocalRestore\(false\)/);
});
