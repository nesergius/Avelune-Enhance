"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const localAi=fs.readFileSync(path.join(root,"src/local-ai.js"),"utf8");
const main=fs.readFileSync(path.join(root,"src/main.js"),"utf8");
const preload=fs.readFileSync(path.join(root,"src/preload.js"),"utf8");
const html=fs.readFileSync(path.join(root,"renderer/out/index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"renderer/out/assets/app.js"),"utf8");
const installer=fs.readFileSync(path.join(root,"resources/local-ai/install-local-restore.ps1"),"utf8");
const runner=fs.readFileSync(path.join(root,"resources/local-ai/local_restore_runner.py"),"utf8");
test("Photo Restore Pro is fully local and has install remove status IPC",()=>{
  assert.match(main,/avelune:get-local-ai-status/);
  assert.match(main,/avelune:install-local-ai/);
  assert.match(main,/avelune:remove-local-ai/);
  assert.match(preload,/installLocalAi/);
  assert.match(html,/Скачать и установить/);
  assert.match(html,/Изображения никуда не отправляются/);
  assert.doesNotMatch(main,/api\.openai\.com|openaiApiKey|safeStorage/);
});
test("downloadable pack pins GFPGAN and Real-ESRGAN official weights",()=>{
  assert.match(installer,/GFPGANv1\.4\.pth/);
  assert.match(installer,/RealESRGAN_x4plus\.pth/);
  assert.match(installer,/TencentARC\/GFPGAN\/releases/);
  assert.match(installer,/xinntao\/Real-ESRGAN\/releases/);
  assert.match(installer,/torch==2\.1\.2/);
  assert.match(installer,/Backend -eq 'cuda'/);
});
test("local runner restores faces and background before NCNN finalization",()=>{
  assert.match(runner,/GFPGANer/);
  assert.match(runner,/RealESRGANer/);
  assert.match(runner,/paste_back=True/);
  assert.match(localAi,/restoreLocal/);
  assert.match(main,/processSingleWithOptionalLocalRestore/);
  assert.match(app,/Avelune Photo Restore Pro/);
});
