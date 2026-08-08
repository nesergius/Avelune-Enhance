"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),test=require("node:test");
const root=path.resolve(__dirname,".."),html=fs.readFileSync(path.join(root,"renderer/out/index.html"),"utf8"),css=fs.readFileSync(path.join(root,"renderer/out/assets/app.css"),"utf8"),renderer=fs.readFileSync(path.join(root,"renderer/out/assets/app.js"),"utf8"),main=fs.readFileSync(path.join(root,"src/main.js"),"utf8"),builder=fs.readFileSync(path.join(root,"tools/build-rc6-release.ps1"),"utf8");
test("enhance workflow uses one sidebar and one fixed image workspace",()=>{assert.match(html,/data-ui="studio-rail-v9"/);assert.match(html,/class="[^"]*sidebar[^"]*"[\s\S]*class="[^"]*enhance-workflow[^"]*"[\s\S]*<main class="main-area"/);assert.doesNotMatch(html,/#view-enhance[\s\S]*class="[^"]*controls-card/);assert.match(html,/id="sidebar-select-file-button"/);assert.doesNotMatch(html,/class="enhance-commandbar"/);});
test("profile choice is readable and not a wall of model cards",()=>{assert.equal((html.match(/<option value="avelune-/g)||[]).length>=7,true);assert.doesNotMatch(html,/class="model-card/);assert.match(html,/Avelune Natural — универсальные фото/);assert.match(html,/Avelune Detail\+ — максимум деталей/);});
test("existing installations migrate to the navigation rail layout",()=>{assert.match(renderer,/compactMenu: false/);assert.match(renderer,/layoutVersion: 9/);assert.match(renderer,/Number\(stored\.layoutVersion \|\| 0\) < 9/);assert.match(renderer,/state\.compactMenu = false/);});
test("main process validates sidebar geometry typography and fixed canvas",()=>{assert.match(main,/--avelune-ui-probe=/);assert.match(main,/controlsInsideSidebar/);assert.match(main,/sidebarReadableWidth/);assert.match(main,/previewUsesRemainingWidth/);assert.match(main,/readableBaseType/);assert.match(main,/noDropScroll/);});
test("main process blocks polished UI regressions in packaged screenshots",()=>{assert.match(main,/toastAvoidsHardware/);assert.match(main,/waitFor\(\(\) => Boolean\(el\('\.toast-stack \.toast'\)\), 1200\)/);assert.match(main,/rectsOverlap\(toastBox, hardwareBox\)/);});
test("release builder blocks success until packaged startup UI matrix and engine probes pass",()=>{assert.match(builder,/Packaged application startup probe passed/);assert.match(builder,/Packaged UI probe passed:/);assert.match(builder,/1280x720@100%/);assert.match(builder,/1366x768@125%/);assert.match(builder,/1920x1080@150%/);assert.match(builder,/Packaged native engine smoke test passed/);assert.match(builder,/PackagedUiProbeMatrixPassed = \$true/);assert.match(builder,/PackagedClipboardPreviewProbePassed = \$true/);assert.match(builder,/PackagedScrollPerformanceProbePassed = \$true/);assert.match(builder,/PackagedVisualRegressionScreenshotsCaptured = \$true/);});


test("packaged sidebar collapse handle stays docked inside the sidebar edge",()=>{
  assert.match(css,/\.sidebar \{[\s\S]*?overflow: hidden;/);
  assert.match(css,/body\[data-active-view="enhance"\] \.sidebar-collapse,[\s\S]*?body\.sidebar-compact\[data-active-view="enhance"\] \.sidebar-collapse \{[\s\S]*?top: 50%;/);
  assert.match(css,/body\[data-active-view="enhance"\] \.sidebar-collapse,[\s\S]*?body\.sidebar-compact\[data-active-view="enhance"\] \.sidebar-collapse \{[\s\S]*?right: 0;/);
  assert.doesNotMatch(css,/left: calc\(var\(--sidebar-width\) - 15px\)/);
  assert.match(main,/controls\.scrollWidth <= controls\.clientWidth \+ 1/);
  assert.match(main,/controlsScroll\.scrollWidth <= controlsScroll\.clientWidth \+ 1/);
  assert.doesNotMatch(main,/sidebar\.scrollWidth <= sidebar\.clientWidth/);
});

test("enhance workspace and sidebar seam has no stacked rounded panel corners",()=>{
  assert.match(css,/body\[data-active-view="enhance"\] \.enhance-workflow,[\s\S]*?body\[data-active-view="enhance"\] \.preview-card \{[\s\S]*?border-radius: 0 !important;/);
  assert.match(css,/body\[data-ui-revision="studio-rc6"\] \.preview-card::before \{[\s\S]*?content: none;/);
});

test("workspace file summary keeps long paths visually quiet",()=>{
  assert.match(renderer,/els\.sourcePath\.textContent = truncateMiddle\(path, 96\);/);
  assert.match(renderer,/els\.sourcePath\.title = path;/);
  assert.match(css,/\.file-summary-copy \{ max-width: min\(760px, 68vw\); \}/);
});

test("batch folder paths keep full tooltips while showing compact labels",()=>{
  assert.match(renderer,/els\.batchInputPath\.textContent = truncateMiddle\(state\.batchFolderPath, 68\);/);
  assert.match(renderer,/els\.batchInputPath\.title = state\.batchFolderPath;/);
  assert.match(renderer,/els\.batchOutputPath\.textContent = truncateMiddle\(state\.batchOutputPath, 68\);/);
  assert.match(renderer,/els\.batchOutputPath\.title = state\.batchOutputPath;/);
});
