"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");const main=fs.readFileSync(path.join(root,"src/main.js"),"utf8");const renderer=fs.readFileSync(path.join(root,"renderer/out/assets/app.js"),"utf8");const preload=fs.readFileSync(path.join(root,"src/preload.js"),"utf8");const integrity=fs.readFileSync(path.join(root,"src/integrity.js"),"utf8");const engine=fs.readFileSync(path.join(root,"src/engine.js"),"utf8");const builder=fs.readFileSync(path.join(root,"tools/build-rc6-release.ps1"),"utf8");
test("job events and cancellation are routed by immutable job id",()=>{assert.match(main,/jobEnvelope\(jobId, jobType/);assert.match(main,/jobManager\.cancel\(id\)/);assert.match(renderer,/immutableJobContext/);assert.match(renderer,/envelope\?\.jobId !== activeSingleJob\.id/);assert.match(renderer,/jobType === "batch"/);assert.doesNotMatch(main,/clearQueued\(/);});
test("completion updates immediately without 450ms race",()=>{assert.doesNotMatch(renderer,/finishSingleProcessing[\s\S]{0,300}setTimeout/);assert.match(renderer,/activeSingleJob = null;\n    processing = false/);});
test("integrity checks are async, cached, and strict about missing manifest entries",()=>{assert.match(integrity,/fs\.createReadStream/);assert.match(integrity,/inFlight = new Map/);assert.doesNotMatch(integrity,/readSync|openSync|cache\.clear\(\)/);assert.match(integrity,/Ресурс отсутствует в манифесте/);});
test("engine includes watchdog and rollback publishing",()=>{assert.match(engine,/DEFAULT_INACTIVITY_TIMEOUT_MS/);assert.match(engine,/перестал отвечать/);assert.match(engine,/avelune-backup-/);assert.match(engine,/fs\.renameSync\(backupPath, finalPath\)/);});
test("renderer uses binary clipboard, safe file URLs and CSP-safe history fallback",()=>{assert.match(renderer,/await file\.arrayBuffer\(\)/);assert.doesNotMatch(renderer,/readAsDataURL|encodedBuffer: base64/);assert.match(preload,/pathToFileURL/);assert.doesNotMatch(renderer,/onerror=/);assert.match(renderer,/history-preview-image/);});
test("state persistence is debounced and release lockfile is immutable",()=>{assert.match(renderer,/window\.setTimeout\(persistState, 240\)/);assert.match(builder,/lockHashBefore/);assert.match(builder,/Release build modified package-lock\.json/);assert.doesNotMatch(builder,/--package-lock-only/);});


test("history uses the immutable profile selected when each job started", () => {
  assert.match(renderer, /immutableJobContext\(type, payload, \{ profile: state\.profile, sourcePreviewUrl: activeSourceObjectUrl \}\)/);
  assert.match(renderer, /profile:job\.metadata\.profile/);
  assert.doesNotMatch(renderer, /profile:state\.profile/);
});

test("non-overwrite output collisions create a fresh filename instead of returning stale results", () => {
  assert.match(engine, /function availableOutputPath\(desiredPath, overwrite = false\)/);
  assert.doesNotMatch(engine, /verifyOutput\(finalPath\); return finalPath/);
});
