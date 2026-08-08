## RC6 FINAL restoration optimization

- Fixed GitHub-hosted Windows release builds on lean PowerShell environments by hashing files through .NET SHA-256 instead of relying on `Get-FileHash`.
- Removed personal root Windows CMD launchers from the public source tree. Ready-to-use Setup and Portable builds now belong in GitHub Releases/CI artifacts, while the reproducible QA builder remains under `tools/build-rc6-release.ps1`.
- Updated the Windows workflow so tag builds can publish Setup, Portable, update metadata and SHA-256 checksums as GitHub Release assets.
- Completed repository hygiene for the public RC6 source tree: required renderer assets are tracked, stale RC note clutter and source-only model weights are excluded, and package metadata points to the GitHub repository and issue tracker.
- Updated RC6 README/release notes to match the current catalog of 11 profiles, 6 official NCNN models and the separately installed local Photo Restore Pro/Ultra packages.
- Added Avelune Smart Restore and Game Images profile modes without adding unverified model weights.
- Fixed Photo Restore Pro CLI compatibility by accepting quality presets in the local runner.
- Fixed Photo Restore Ultra runtime verification: installer now pins a BasicSR-compatible torch/torchvision pair and imports the full DiffBIR/GFPGAN/Real-ESRGAN stack before writing `installed.json`.
- Fixed missing DiffBIR runtime dependencies in the Ultra installer: pandas, ftfy, regex and torchsde are installed and verified before the package is marked ready.
- Fixed DiffBIR v2.1 CLI compatibility in the Ultra runner: integer `noise_aug`, official cleaner/VAE/CLDM tile flags and control `strength` are now passed correctly.
- Tuned Ultra quality presets for better 8 GB GPU efficiency while keeping Maximum mode high quality, and added a QA-only step override for fast end-to-end smoke tests.
- Fixed first-run network dependency in Photo Restore Pro/Ultra: installers now include GFPGAN facexlib detection/parsing weights and mark packages as `runtimePatch=3`.
- Completed the Ultra cascade: DiffBIR scene restoration, GFPGAN face refinement, then existing Avelune Real-ESRGAN finalization.
- Updated Smart Restore routing with damage, blur, color, art/game and VRAM heuristics; 8 GB-class GPUs are accepted from 7.5 GiB dedicated VRAM.
- Added a professional restoration pre/post pipeline for Pro and Ultra: old-photo white balance, CLAHE contrast recovery, conservative denoise/deblock, mild finishing sharpen and graphic-safe guards for UI/text/line-art.
- Fixed the empty Smart Queue header: the retry action is hidden until failed items actually exist.
- Polished the batch Smart Queue card spacing so its header and empty state align with the other Windows Studio panels.
- Gated Photo Restore Pro and Photo Restore Ultra by real installed-package status so unavailable restore profiles cannot be selected or shown as active.
- Removed the legacy sidebar processing overlay from the RC6 UI path; processing now uses only the polished workspace HUD.
- Added a multilingual UI layer with automatic system-language detection and a Settings language selector for popular locales.
- Expanded the language matrix to 47 selectable locales, including Kazakh and regional auto-detection aliases.
- Completed English UI coverage for static and dynamic renderer strings, including model catalog cards, AI package statuses, toasts, progress HUDs and mixed inline headings.
- Completed generated UI dictionaries for every selectable non-Russian locale and added a regression audit that blocks missing strings, English fallback gaps and leaked generation placeholders; Kazakh now has manual overrides for core UI terms.

## RC6 FIXED8
- Добавлен Avelune Generative Restore: OpenAI GPT Image с высоким сохранением входа и локальной TTA-финализацией.
- API-ключ хранится зашифрованно и облачный режим выключен по умолчанию.

## RC6 FIXED5 — compact workflow header

- Removed the redundant “AI IMAGE STUDIO”, “Новое улучшение” and “Четыре шага до готового результата” copy from the enhance sidebar header.
- Kept the four-step progress indicator centered at every supported viewport width and DPI.
- Kept the reset action aligned on the right without shifting the centered step indicator.


## RC6 FIXED4 — runtime resource manifest

- Runtime integrity now reads the packaged `resource-manifest.json` instead of a stale ASAR snapshot.
- Resource generation synchronizes `src/resource-integrity.json` for audits and legacy tooling.
- Pre-package verification blocks the build if the mirror and packaged manifest differ.
- Added regression coverage for downloaded RealESRNet and manifest path validation.

# 2.0.0 RC6 — prepared-model compliance test hotfix

- Исправлен ложный провал `RC6 source bundles only verified base model files before pinned preparation` после успешной загрузки официальных моделей.
- Тест теперь поддерживает два допустимых состояния каталога: чистый исходник с четырьмя базовыми файлами и подготовленный Windows-build с полным проверенным набором RC6.
- В подготовленном состоянии строго проверяются точный список файлов, официальный manifest, размеры, SHA-256, закреплённые RealESRNet-хэши и официальные URL релизов.
- Защитная проверка не отключена и не ослаблена: посторонние или неполные файлы по-прежнему приводят к ошибке сборки.

# 2.0.0 RC6

## 2.0.0 RC6 — quality, workflow and QA

- Added six verified official NCNN model identifiers and eleven transparent profiles.
- Added local Auto Profile, real-engine region preview, persistent Smart Queue and GPU AutoTune.
- Added conservative RealESRNet face refinement with strength-dependent quality mode.
- Added compatible metadata/ICC preservation for JPEG, PNG and extended WebP.
- Replaced brittle single-geometry release checks with a multi-viewport packaged QA matrix and screenshots.
- Refreshed the production logo and Windows icon assets.

# 2.0.0 RC6 — quality, workflow and QA foundation

- Добавлены проверяемые distinct-модели RealESRNet x4plus и AnimeVideo v3 2×/3×/4×.
- Builder закрепляет официальный архив SHA-256, проверяет ранее переименованные модели byte-for-byte и формирует manifest добавленных файлов.
- Добавлен локальный Auto Profile с объяснением выбора.
- Добавлен real-engine preview фрагмента до 512×512 и кэш профилей.
- Пакетный режим заменён на Smart Queue с pause/resume, повтором ошибок, пропуском готовых файлов и per-item progress.
- Добавлен консервативный локальный второй проход восстановления лиц без ложного заявления GFPGAN.
- Добавлено безопасное сохранение совместимых JPEG/PNG/extended-WebP метаданных и ICC.
- Добавлены GPU AutoTune и автоматический tile fallback при OOM/device lost.
- Release gate переведён на матрицу разрешений/DPI со скриншотами; QA-failed артефакты сохраняются.
- Обновлены логотип, taskbar/installer icons и документация происхождения моделей.
- Build version: 2.0.0.600.

## UI Overhaul v10.2 — official model previews and compact cancellation

- В окно выбора профиля добавлены официальные демонстрационные материалы Real-ESRGAN для двух реально поставляемых базовых моделей.
- Примеры загружаются только во время подготовки исходников/сборки и затем работают локально из пакета приложения; пользовательские изображения никуда не передаются.
- Для чистой сборки предусмотрены локальные SVG-заглушки, если GitHub временно недоступен.
- У базовой модели добавлена зелёная галочка с подсказкой «Официальная модель».
- Большая красная кнопка остановки удалена из левой панели; отмена остаётся в компактном HUD рабочей области.
- Build version: 2.0.0.520.

## UI Overhaul v10.1 — packaged sidebar gate

- Исправлено ложное падение Windows release-gate с `sidebarReadableWidth:false`.
- UI v10 использует боковую область 396 px при 1366×768, тогда как проверка ошибочно оставалась ограничена диапазоном v9 320–380 px.
- Проверка теперь сверяет фактическую ширину с активной CSS-переменной `--sidebar-width` и сохраняет безопасные границы 340–410 px.
- Остальные packaged-проверки не ослаблены.

# UI Overhaul v9.3 — packaged clipboard gate fix

- Устранено повторное ложное падение `clipboardPreviewPassed` на Windows.
- Проверка больше не зависит от текста разрешения и символа `×`, который искажался в PowerShell/консольной кодировке.
- Успех определяется по фактическому состоянию DOM: изображение полностью загружено, имеет размер 1×1 и использует renderer-owned `blob:` URL.
- После завершения `waitFor` создаётся единый финальный снимок DOM; и результат проверки, и `clipboardDebug` вычисляются из него. Поэтому отчёт больше не может показывать успешные размеры/`blob:` при `clipboardPreviewPassed:false`.
- Пользовательская вставка из буфера, движок, модели и параметры обработки не изменялись.

# 2.0.0 RC5.2.1 (post-RC5.2 fix)

- Таймаут 20с тоже не хватило: `clipboardDebug` на новом провальном
  прогоне снова показал полностью успешное состояние (`srcScheme:
  "blob"`, `naturalWidth/Height: 1`, `resolutionText: "1 × 1"`,
  `complete: true`) — то есть round trip завершается, но заметно позже
  таймаута. Раз проблема не в 5с и не в 20с, дело не в "чуть
  подождать больше", а в конкретном узком месте.
- Вероятная причина: синтетический тест сохраняет файл в реальную
  папку `Pictures` (`app.getPath("pictures")`), а это одна из папок,
  которые Windows Defender по умолчанию защищает через Controlled
  Folder Access — для ещё не заслуживших репутацию приложений (только
  что собранный и подписанный exe — ровно этот случай) запись может
  сильно тормозиться или виртуализироваться, что и объясняет
  непредсказуемую многосекундную задержку независимо от таймаута.
- Во время `--avelune-ui-probe=` clipboard-проба теперь пишет файл не
  в `Pictures`, а в собственную одноразовую папку `userData\
  probe-clipboard`, которая никогда не защищена CFA. Обычные
  пользователи не затронуты — им по-прежнему по умолчанию Pictures.
- Также в `clipboardDebug` добавлено поле `waitedMs` — сколько
  реально миллисекунд заняло ожидание. Если гипотеза про Pictures
  неверна, следующий прогон покажет точную цифру вместо догадок.

- Диагностика сработала: `clipboardDebug` на реальном провальном запуске
  показал `srcScheme:"blob"`, `naturalWidth`/`naturalHeight`: 1,
  `resolutionText:"1 × 1"`, `complete:true` — то есть весь путь
  (запись файла → IPC → decode blob-превью) **фактически завершается
  успешно**. Значит, это не баг функциональности, а таймаут: на
  реальном Windows-железе запись файла в `Pictures` + вероятное
  сканирование антивирусом в реальном времени + IPC round-trip иногда
  занимают больше отведённых 5 секунд, а проба к этому моменту уже
  фиксирует `false`, хотя состояние становится верным чуть позже.
- Увеличен таймаут именно этой проверки с 5000 до 20000 мс. Это
  единственное место, где используется `waitFor`, так что изменение
  не затрагивает остальную логику пробы.

- Progress check: после фикса с `app.disableHardwareAcceleration()` для
  проб `scrollPerformancePassed` стал `true` (150 кадров, p95 ≈ 6.1мс) —
  и все геометрические проверки тоже `true`. Остаётся один провал:
  `clipboardPreviewPassed: false`.
- Прослежена вся цепочка вручную по метрикам провалившегося запуска:
  файл из синтетического clipboard-теста реально сохраняется на диск
  (в `app.getPath("pictures")`, путь виден в `clipboardPreviewPath`),
  и `#source-path` в DOM обновляется этим же путём — то есть
  `PASTE_IMAGE_SAVE_SUCCESS` доходит и `setSourceImage()` вызывается
  корректно. Дальше цепочка уходит в загрузку `<img>` через blob-URL
  (`onload`/`onerror`), и без живого Chromium-рантайма нельзя
  однозначно сказать, какая ветка сработала.
- Вместо дальнейших догадок добавлена диагностика прямо в пробу:
  теперь при `clipboardPreviewPassed: false` в JSON-отчёте появляется
  `checks.clipboardDebug` — `resolutionText`, `srcScheme` (`blob`/
  `file`/`none`), `naturalWidth/Height`, `complete`. Следующий
  провальный прогон покажет точно, на чём застряло превью, вместо
  голого `false`.

- Найдена и устранена настоящая причина провала packaged UI probe при
  1366×768: probe-окно никогда не показывалось (`show: false` и без
  последующего `show()`), поэтому Chromium троттлил
  `requestAnimationFrame` примерно до 1 Гц независимо от
  `backgroundThrottling`. Это давало один "кадр" длительностью ~997 мс
  и одновременно занижало точность clipboard/paint-проверок.
- Идентичная ошибка `GPU state invalid after WaitForGetOffsetInRange`
  повторилась и после того, как окно стало показываться нормально —
  значит, дело было не в видимости/позиции окна вообще. Это реальный
  сбой GPU-процесса Chromium (рассинхронизация D3D/ANGLE command
  buffer), который встречается на машинах с проблемными
  GPU-драйверами, гибридной графикой или виртуализированным экраном
  (RDP и т.п.) и не зависит от того, что делает наш JS-код с окном.
  Когда GPU-контекст теряется прямо во время замера, Chromium
  перезапускает GPU-процесс, и первый `requestAnimationFrame`
  зависает на сотни миллисекунд — тот же симптом (`p95FrameMs`/
  `maxFrameMs` ≈ 997), но другая причина.
- Проба сама по себе не нуждается в аппаратном ускорении — только в
  реальных, вовремя приходящих кадрах. Для запусков с
  `--avelune-ui-probe=`/`--avelune-runtime-probe=` теперь вызывается
  `app.disableHardwareAcceleration()`, что переключает Chromium на
  программный рендеринг (SwiftShader) и убирает саму возможность
  потери GPU-контекста. Обычные пользовательские запуски приложения
  ускорение не теряют.
- Полный набор из 93 статических тестов проходит без регрессий.

# 2.0.0 RC5.2

- Исправлен preview изображений, вставленных через Ctrl+V.
- Добавлен renderer-owned blob preview и бинарный IPC fallback.
- Clipboard save/preview связаны UUID; последняя вставка всегда выигрывает.
- Устранена прокрутка параметров по умолчанию при 1366×768 и 1280×720.
- Сохранена нативная Chromium compositor-прокрутка без wheel interception.
- Добавлены packaged clipboard, frame pacing, layout shift и dual-resolution UI gates.
- Исправлено оформление toast и уплотнён workflow без уменьшения базового шрифта.
- Source Snapshot создаётся кроссплатформенным Node.js stager без robocopy.

# 2.0.0 RC5.0.2

- Полностью переработан рабочий экран в Compact Studio.
- Устранена прокрутка preview и всего enhance-view.
- Добавлены сворачиваемые navigation rail и controls panel.
- Удалены тяжёлые фоновые эффекты и постоянные compositor layers.
- Добавлены packaged startup, UI geometry и AI engine smoke gates.
- Добавлены адаптивные режимы 1366×768 и малой высоты.

# 2.0.0 RC4.3.1

- Исправлена несовместимость путей упакованных нативных ресурсов.
- `avelune-engine.exe`, GPU helper и `vcomp140.dll` упаковываются в `resources/win/bin`.
- Добавлена обязательная проверка структуры `win-unpacked` в release builder.
- Добавлены регрессионные тесты полного integrity preflight.

# 2.0.0 RC4.2.4

- Добавлена отсутствовавшая вертикальная линия сравнения.
- Устранён стандартный шаг range в 1%, вызывавший скачки.
- Слайдер переведён на точные pointer coordinates.
- Добавлена дробная точность и управление с клавиатуры.
- Отключены переходы линии и маски сравнения.

# 2.0.0 RC4.2.3

- Исправлен импорт JPG/PNG/WebP перетаскиванием из Проводника.
- `File.path` заменён на `webUtils.getPathForFile`.
- Добавлена отдельная диагностика ошибки получения системного пути.
- Исправлена очистка Source Snapshot от старых сборок и резервных папок.

# 2.0.0 RC4.2.2

- Отключена инерционная прокрутка Chromium.
- Добавлена прямая обработка колеса мыши и тачпада.
- Отключён renderer background throttling.
- На Windows запрашивается производительный GPU.
- Устранены анимационные очереди крупных карточек и панелей.
- Эффекты сохраняются, но приостанавливаются непосредственно во время прокрутки.

# 2.0.0 RC4.2.1

- Исправлено дрожание и «плавающее» поведение интерфейса при прокрутке.
- Удалены принудительные GPU-слои с scroll-контейнеров.
- Устранена вложенная прокрутка панели параметров.
- Убрано смещение карточек при наведении во время прокрутки.
- Снижена стоимость перерисовки постоянных панелей.

# 2.0.0 RC4.2

- Added five transparent processing profiles on top of two verified Real-ESRGAN model pairs.
- Separated AI models from processing profiles in the catalog and filters.
- Updated single and batch selection logic without duplicating model weights.
- Updated version metadata and Windows release builder.

# 2.0.0 RC4.1

- Removed five models with incomplete provenance or redistribution records.
- Reduced the bundled catalog to two verified Real-ESRGAN-based models.
- Added safe migration for settings saved with removed model IDs.
- Added third-party license files to source and packaged builds.
- Rebuilt the native-engine Corresponding Source archive with portable paths.
- Updated integrity manifests and release metadata.

# Changelog

## 2.0.0 RC3

- Consolidated all UI fixes through the model-manager release.
- Enabled Electron sandbox, context isolation and web security.
- Added strict IPC allowlists and sender validation.
- Added Content Security Policy and blocked navigation, webviews and permissions.
- Added a sequential GPU job queue and targeted cancellation of the active task.
- Added strict validation for paths, formats, model identifiers, dimensions and clipboard payloads.
- Added output-size limits and corrupt-image detection.
- Added temporary output files and atomic publication of completed results.
- A task now succeeds only after a zero engine exit code and successful result decoding.
- Batch processing publishes every image separately and reports per-file progress.
- Double pass preserves the requested target width instead of producing an accidental 16x result.
- Added SHA-256 integrity validation for the engine and bundled model files.
- Removed the debug runtime DLL.
- Renamed the local engine and remaining old internal profile IDs to Avelune-neutral names.
- Replaced technical references to model “weights” in the UI with user-friendly wording.
- Added Windows hardware and driver diagnostic scripts for the 2/7 release gate.

## 2.0.0 RC5.2 UI Overhaul v9.1

- Fixed false packaged UI-probe failure caused by the intentionally protruding sidebar collapse handle.
- Made clipboard preview validation independent of Windows console encoding of the multiplication sign.
- Added regression tests for both release-gate fixes.
### RC6 model fetch hotfix

- Fixed Windows builder failure when the official v0.2.5.0 Windows package omits `realesrnet-x4plus`.
- Current AnimeVideo-v3 files remain sourced from the pinned v0.2.5.0 package.
- RealESRNet x4plus is sourced from the official v0.2.3.0 package and verified by pinned per-file SHA-256 values.
- Cached fallback archives are re-downloaded automatically when extracted files fail verification.

### RC6 build hotfix — primary workflow visual QA

- Fixed the multi-viewport QA gate incorrectly requiring the fixed start button to be inside the scroll container.
- The gate now verifies the real RC6 layout and records source/start control geometry.

### RC6 hotfix — instant region preview result

- Fixed the enhanced side of Instant Region Preview appearing blank with only the alt text visible.
- Region results are now loaded through the validated local binary preview IPC path instead of relying on a direct `file://` URL.
- The progress panel closes only after the enhanced image has actually decoded.
- Added bounded preview caching with object-URL cleanup and a regression test for the broken result path.

## RC6 FIXED9
- Removed OpenAI cloud restoration and API-key settings.
- Added optional downloadable Local Photo Restore Pro pack.
- Added isolated Python runtime installer with NVIDIA CUDA and universal CPU modes.
- Added GFPGAN 1.4 face reconstruction and Real-ESRGAN background restoration before NCNN/TTA finalization.
- Added install progress, status, disk usage, reinstall and remove controls.

- FIXED10: downloadable Photo Restore Ultra (DiffBIR v2.1), separate Pro fallback, tiered local AI manager.
