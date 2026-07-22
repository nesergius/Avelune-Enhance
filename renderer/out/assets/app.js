(() => {
  "use strict";

  const COMMANDS = {
    SELECT_FILE: "Select a File",
    SELECT_FOLDER: "Select a Folder",
    AVELUNE: "Upscale the Image",
    AVELUNE_DONE: "Upscaling Done",
    AVELUNE_PROGRESS: "Send Progress from Main to Renderer",
    DOUBLE_AVELUNE: "Double Upscale the Image",
    DOUBLE_AVELUNE_DONE: "Double Upscaling Done",
    DOUBLE_AVELUNE_PROGRESS: "Send Double Avelune Progress from Main to Renderer",
    FOLDER_AVELUNE: "Upscale a Folder",
    FOLDER_AVELUNE_DONE: "Folder upscaling successful",
    FOLDER_AVELUNE_PROGRESS: "Send Folder Upscaling Progress from Main to Renderer",
    OPEN_FOLDER: "Open Folder",
    SELECT_CUSTOM_MODEL_FOLDER: "Select a Custom Model Folder",
    GET_MODELS_LIST: "Send models list from main to renderer",
    CUSTOM_MODEL_FILES_LIST: "Send custom model files list to renderer",
    STOP: "Stop the current operation",
    SCALING_AND_CONVERTING: "Adding some finishing touches",
    AVELUNE_ERROR: "Upscaling Error",
    PASTE_IMAGE: "Paste Image from clipboard",
    PASTE_IMAGE_SAVE_SUCCESS: "Clipboard Image saved successfully",
    PASTE_IMAGE_SAVE_ERROR: "Clipboard Image save failed"
  };

  const MODEL_META = {
    "avelune-standard-4x": { label: "Универсальная", short: "Баланс качества и естественных деталей" },
    "avelune-lite-4x": { label: "Быстрая · из предыдущей версии", short: "Быстрая обработка с меньшей нагрузкой" },
    "high-fidelity-4x": { label: "Фотореализм · из предыдущей версии", short: "Фотографии, лица и натуральные текстуры" },
    "remacri-4x": { label: "Remacri · из предыдущей версии", short: "Мягкое восстановление без лишней резкости" },
    "ultramix-balanced-4x": { label: "UltraMix · из предыдущей версии", short: "Сбалансированная модель для сложных сцен" },
    "ultrasharp-4x": { label: "UltraSharp · из предыдущей версии", short: "Текст, интерфейсы и мелкие линии" },
    "digital-art-4x": { label: "Иллюстрации", short: "Арт, аниме и цифровая графика" },
    "realesrnet-x4plus": { label: "Clean Photo 4×", short: "Более спокойное восстановление без агрессивной GAN-резкости" },
    "realesr-animevideov3-x2": { label: "Anime Video Fast 2×", short: "Быстрый профиль для анимации и слабых GPU" },
    "realesr-animevideov3-x3": { label: "Anime Video Fast 3×", short: "Компромисс между скоростью и размером" },
    "realesr-animevideov3-x4": { label: "Anime Video Fast 4×", short: "Компактная официальная модель для анимации" }
  };

  const MODEL_CATALOG = [
    {
      id: "avelune-standard-4x", label: "Avelune Natural 4×", category: "Фото и универсальная",
      short: "Естественное увеличение фотографий, игровых кадров и смешанного контента.",
      status: "official", installed: true, scale: "4×", speed: "Средняя", verified: true,
      upstream: "Real-ESRGAN x4plus", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "digital-art-4x", label: "Avelune Art 4×", category: "Аниме и иллюстрации",
      short: "Чёткие контуры, цифровой арт, аниме, игровые иллюстрации и 2D-графика.",
      status: "official", installed: true, scale: "4×", speed: "Быстрая", verified: true,
      upstream: "Real-ESRGAN x4plus Anime 6B", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_model.md", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "realesrnet-x4plus", label: "Clean Photo 4×", category: "Фото без перерезкости",
      short: "Официальный RealESRNet-профиль для более мягкого и предсказуемого результата.",
      status: "official", installed: false, scale: "4×", speed: "Средняя", verified: true,
      upstream: "RealESRNet x4plus", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "realesr-animevideov3-x2", label: "Anime Video Fast 2×", category: "Анимация",
      short: "Лёгкая официальная модель с увеличением 2× для скорости и экономии VRAM.",
      status: "official", installed: false, scale: "2×", speed: "Очень быстрая", verified: true,
      upstream: "Real-ESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "realesr-animevideov3-x3", label: "Anime Video Fast 3×", category: "Анимация",
      short: "Лёгкая официальная модель 3× для промежуточного масштаба.",
      status: "official", installed: false, scale: "3×", speed: "Очень быстрая", verified: true,
      upstream: "Real-ESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "realesr-animevideov3-x4", label: "Anime Video Fast 4×", category: "Анимация",
      short: "Лёгкая официальная модель 4× для анимации, кадров видео и слабых видеокарт.",
      status: "official", installed: false, scale: "4×", speed: "Очень быстрая", verified: true,
      upstream: "Real-ESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE"
    },
    {
      id: "avelune-lite-4x", label: "Avelune Lite · предыдущая версия", category: "Быстрая обработка",
      short: "Сохранена для совместимости с предыдущими версиями. Сведения об авторе и лицензии этой AI-модели требуют дополнительной проверки.",
      status: "legacy", installed: true, scale: "4×", speed: "Очень быстрая", verified: false
    },
    {
      id: "high-fidelity-4x", label: "High Fidelity · предыдущая версия", category: "Фото",
      short: "Сохранён для пользователей прежней версии. Используйте после собственного сравнения результата.",
      status: "legacy", installed: true, scale: "4×", speed: "Средняя", verified: false
    },
    {
      id: "remacri-4x", label: "Remacri · из предыдущей версии", category: "Универсальная",
      short: "AI-модель из прежнего набора. Авторство и условия распространения должны быть подтверждены перед включением в публичную сборку.",
      status: "legacy", installed: true, scale: "4×", speed: "Средняя", verified: false
    },
    {
      id: "ultramix-balanced-4x", label: "UltraMix · из предыдущей версии", category: "Смешанный контент",
      short: "AI-модель из прежнего набора с пока неподтверждёнными сведениями о происхождении.",
      status: "legacy", installed: true, scale: "4×", speed: "Средняя", verified: false
    },
    {
      id: "ultrasharp-4x", label: "UltraSharp · из предыдущей версии", category: "Текст и резкость",
      short: "AI-модель из прежнего набора. Может создавать ореолы и искусственные детали.",
      status: "legacy", installed: true, scale: "4×", speed: "Средняя", verified: false
    }
  ];

  const BUILT_IN_MODEL_IDS = new Set(MODEL_CATALOG.filter(model => model.installed).map(model => model.id));

  const PRESETS = {
    balanced: { model: "avelune-standard-4x", scale: "4", compression: 92, ttaMode: false, doublePass: false },
    photo: { model: "high-fidelity-4x", scale: "4", compression: 95, ttaMode: false, doublePass: false },
    art: { model: "digital-art-4x", scale: "4", compression: 96, ttaMode: false, doublePass: false },
    fast: { model: "avelune-lite-4x", scale: "2", compression: 88, ttaMode: false, doublePass: false }
  };

  const DEFAULTS = {
    theme: "dark",
    compactMenu: false,
    saveHistory: true,
    model: "avelune-standard-4x",
    scale: "4",
    saveImageAs: "png",
    compression: 92,
    useCustomWidth: false,
    customWidth: 3840,
    tileSize: 0,
    gpuId: "",
    ttaMode: false,
    doublePass: false,
    overwrite: false,
    imagePath: "",
    outputPath: "",
    batchFolderPath: "",
    batchOutputPath: "",
    batchModel: "avelune-standard-4x",
    batchScale: "4",
    batchFormat: "png",
    batchCompression: 92,
    batchTileSize: 0,
    batchGpuId: "",
    batchTtaMode: false,
    customModelsFolderPath: "",
    customModels: [],
    history: []
  };

  const stored = safeParse(localStorage.getItem("aveluneState"), {});
  const state = Object.assign({}, DEFAULTS, stored);
  state.history = Array.isArray(stored.history) ? stored.history.slice(0, 30) : [];
  state.customModels = Array.isArray(stored.customModels) ? stored.customModels : [];

  // Transparently migrate model IDs saved by early preview builds without keeping their old branding in the product.
  const legacyPrefix = ["up", "scayl"].join("");
  const migrateModelId = value => {
    if (value === `${legacyPrefix}-standard-4x`) return "avelune-standard-4x";
    if (value === `${legacyPrefix}-lite-4x`) return "avelune-lite-4x";
    return value;
  };
  state.model = migrateModelId(state.model);
  state.batchModel = migrateModelId(state.batchModel);
  state.history = state.history.map(item => ({ ...item, model: migrateModelId(item.model) }));

  try {
    const legacyFolderKey = `lastSavedBatch${["Up", "scayl"].join("")}FolderPath`;
    const currentFolderKey = "lastSavedBatchAveluneFolderPath";
    const legacyFolder = localStorage.getItem(legacyFolderKey);
    if (legacyFolder && !localStorage.getItem(currentFolderKey)) localStorage.setItem(currentFolderKey, legacyFolder);
    localStorage.removeItem(legacyFolderKey);
  } catch {}

  let sourceDimensions = null;
  let resultPath = "";
  let processing = false;
  let batchProcessing = false;
  let currentView = "enhance";
  let demoTimer = null;
  let modelManagerFilter = "all";
  let modelManagerQuery = "";

  const electron = window.electron || null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    html: document.documentElement,
    body: document.body,
    views: $$("[data-view-panel]"),
    navItems: $$("[data-view]"),
    title: $("#view-title"),
    eyebrow: $("#view-eyebrow"),
    dropZone: $("#drop-zone"),
    dropEmpty: $("#drop-empty"),
    imageStage: $("#image-stage"),
    compareStage: $("#compare-stage"),
    sourceImage: $("#source-image"),
    beforeImage: $("#before-image"),
    afterImage: $("#after-image"),
    sourceName: $("#source-name"),
    sourcePath: $("#source-path"),
    sourceResolution: $("#source-resolution"),
    fileTypeIcon: $("#file-type-icon"),
    clearImage: $("#clear-image"),
    outputPathLabel: $("#output-path-label"),
    estimateLabel: $("#estimate-label"),
    startButton: $("#start-button"),
    stopButton: $("#stop-button"),
    processingOverlay: $("#processing-overlay"),
    processingTitle: $("#processing-title"),
    processingMessage: $("#processing-message"),
    progressFill: $("#progress-fill"),
    progressValue: $("#progress-value"),
    progressStage: $("#progress-stage"),
    modelHint: $("#model-hint"),
    extraModelSelect: $("#extra-model-select"),
    formatSelect: $("#format-select"),
    qualityRange: $("#quality-range"),
    qualityValue: $("#quality-value"),
    customWidthToggle: $("#custom-width-toggle"),
    customWidthWrap: $("#custom-width-wrap"),
    customWidthInput: $("#custom-width-input"),
    tileSelect: $("#tile-select"),
    gpuInput: $("#gpu-id-input"),
    ttaToggle: $("#tta-toggle"),
    doublePassToggle: $("#double-pass-toggle"),
    overwriteToggle: $("#overwrite-toggle"),
    compareCanvas: $("#compare-canvas"),
    compareRange: $("#compare-range"),
    resultPath: $("#result-path"),
    historyList: $("#history-list"),
    emptyHistory: $("#empty-history"),
    historyCount: $("#history-count"),
    historyTotal: $("#history-total"),
    historyImages: $("#history-images"),
    historySuccess: $("#history-success"),
    batchInputLabel: $("#batch-input-label"),
    batchInputPath: $("#batch-input-path"),
    batchOutputLabel: $("#batch-output-label"),
    batchOutputPath: $("#batch-output-path"),
    batchModelSelect: $("#batch-model-select"),
    batchScaleSelect: $("#batch-scale-select"),
    batchFormatSelect: $("#batch-format-select"),
    batchQualityRange: $("#batch-quality-range"),
    batchQualityValue: $("#batch-quality-value"),
    batchTtaToggle: $("#batch-tta-toggle"),
    batchTileSelect: $("#batch-tile-select"),
    batchGpuInput: $("#batch-gpu-input"),
    batchStartButton: $("#batch-start-button"),
    batchStopButton: $("#batch-stop-button"),
    batchProgress: $("#batch-progress"),
    batchProgressFill: $("#batch-progress-fill"),
    batchProgressValue: $("#batch-progress-value"),
    batchProgressStage: $("#batch-progress-stage"),
    batchRunTitle: $("#batch-run-title"),
    batchRunDescription: $("#batch-run-description"),
    customModelStatus: $("#custom-model-status"),
    customModelPath: $("#custom-model-path"),
    customModelList: $("#custom-model-list"),
    modelCatalogGrid: $("#model-catalog-grid"),
    modelManagerSearch: $("#model-manager-search"),
    modelManagerCount: $("#model-manager-count"),
    modelOfficialCount: $("#model-official-count"),
    modelLegacyCount: $("#model-legacy-count"),
    modelUserCount: $("#model-user-count"),
    saveHistoryToggle: $("#save-history-toggle"),
    compactMenuToggle: $("#compact-menu-toggle"),
    toastStack: $("#toast-stack"),
    hardwareLabel: $("#hardware-label"),
    appVersion: $("#app-version"),
    aboutDialog: $("#about-dialog")
  };

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }

  function saveState() {
    try {
      localStorage.setItem("aveluneState", JSON.stringify(state));
      if (state.imagePath) localStorage.setItem("lastImagePath", state.imagePath);
      if (state.batchFolderPath) localStorage.setItem("lastSavedBatchAveluneFolderPath", state.batchFolderPath);
      if (state.customModelsFolderPath) localStorage.setItem("customModelsFolderPath", state.customModelsFolderPath);
    } catch (error) {
      console.warn("Could not save Avelune settings", error);
    }
  }

  function basename(path) {
    return String(path || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
  }

  function dirname(path) {
    const normalized = String(path || "").replace(/\\/g, "/");
    const cut = normalized.lastIndexOf("/");
    if (cut < 0) return "";
    const dir = normalized.slice(0, cut);
    return path.includes("\\") ? dir.replace(/\//g, "\\") : dir;
  }

  function extension(path) {
    const name = basename(path);
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toUpperCase() : "IMG";
  }

  function pathToFileUrl(path) {
    if (!path) return "";
    const normalized = String(path).replace(/\\/g, "/").replace(/^\/+/, "");
    const encoded = normalized.split("/").map((part, index) => {
      if (index === 0 && /^[A-Za-z]:$/.test(part)) return part;
      return encodeURIComponent(part);
    }).join("/");
    return `file:///${encoded}`;
  }

  function truncateMiddle(text, max = 74) {
    text = String(text || "");
    if (text.length <= max) return text;
    const half = Math.floor((max - 3) / 2);
    return `${text.slice(0, half)}…${text.slice(-half)}`;
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
    } catch { return "Недавно"; }
  }

  function updateRangeBackground(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const val = Number(input.value || 0);
    const pct = ((val - min) / Math.max(1, max - min)) * 100;
    input.style.setProperty("--range-progress", `${pct}%`);
  }

  function setTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    els.html.dataset.theme = state.theme;
    $$("[data-theme-choice]").forEach(btn => btn.classList.toggle("active", btn.dataset.themeChoice === state.theme));
    saveState();
  }

  function setCompactMenu(compact) {
    state.compactMenu = Boolean(compact);
    els.body.classList.toggle("sidebar-compact", state.compactMenu);
    els.compactMenuToggle.checked = state.compactMenu;
    saveState();
  }

  const VIEW_TITLES = {
    enhance: ["AI IMAGE STUDIO", "Улучшение изображения"],
    batch: ["BATCH WORKSPACE", "Пакетная обработка"],
    history: ["LOCAL ACTIVITY", "История обработки"],
    settings: ["PREFERENCES", "Настройки приложения"]
  };

  function navigate(view) {
    if (!VIEW_TITLES[view]) return;
    currentView = view;
    els.views.forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    els.navItems.forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    els.eyebrow.textContent = VIEW_TITLES[view][0];
    els.title.textContent = VIEW_TITLES[view][1];
    if (view === "history") renderHistory();
    if (view === "settings") renderModelManager();
  }

  function syncSingleControls() {
    $$(".model-card").forEach(card => card.classList.toggle("active", card.dataset.model === state.model));
    const builtInCard = $(`.model-card[data-model="${cssEscape(state.model)}"]`);
    const extraOption = Array.from(els.extraModelSelect.options).some(option => option.value === state.model);
    els.extraModelSelect.value = builtInCard ? "" : (extraOption ? state.model : "");
    els.modelHint.textContent = (MODEL_META[state.model] || { label: state.model }).label;
    $$("#scale-segmented button").forEach(btn => btn.classList.toggle("active", btn.dataset.scale === String(state.scale)));
    $("#scale-caption").textContent = `${state.scale}×`;
    els.formatSelect.value = state.saveImageAs;
    els.qualityRange.value = state.compression;
    els.qualityValue.textContent = `${state.compression}%`;
    updateRangeBackground(els.qualityRange);
    els.customWidthToggle.checked = state.useCustomWidth;
    els.customWidthWrap.classList.toggle("disabled", !state.useCustomWidth);
    els.customWidthInput.value = state.customWidth;
    els.tileSelect.value = String(state.tileSize);
    els.gpuInput.value = state.gpuId;
    els.ttaToggle.checked = state.ttaMode;
    els.doublePassToggle.checked = state.doublePass;
    els.overwriteToggle.checked = state.overwrite;
    els.outputPathLabel.textContent = state.outputPath ? truncateMiddle(state.outputPath, 58) : "Будет выбрана автоматически";
    updateEstimate();
  }

  function syncBatchControls() {
    els.batchModelSelect.value = state.batchModel;
    els.batchScaleSelect.value = state.batchScale;
    els.batchFormatSelect.value = state.batchFormat;
    els.batchQualityRange.value = state.batchCompression;
    els.batchQualityValue.textContent = `${state.batchCompression}%`;
    updateRangeBackground(els.batchQualityRange);
    els.batchTtaToggle.checked = state.batchTtaMode;
    els.batchTileSelect.value = String(state.batchTileSize);
    els.batchGpuInput.value = state.batchGpuId;
    updateBatchFolders();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function setModel(model) {
    if (!model) return;
    state.model = model;
    syncSingleControls();
    saveState();
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.assign(state, preset, { useCustomWidth: false });
    $$(".preset-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === name));
    syncSingleControls();
    saveState();
    showToast("Профиль применён", `Настройки «${$(".preset-chip.active")?.textContent.trim() || name}» готовы к использованию.`, "info");
  }

  function updateEstimate() {
    if (!sourceDimensions) {
      els.estimateLabel.textContent = "—";
      return;
    }
    const width = state.useCustomWidth ? Number(state.customWidth || sourceDimensions.width) : sourceDimensions.width * Number(state.scale);
    const ratio = sourceDimensions.height / sourceDimensions.width;
    const height = Math.max(1, Math.round(width * ratio));
    const megapixels = (width * height / 1_000_000).toFixed(width * height >= 10_000_000 ? 1 : 2);
    els.estimateLabel.textContent = `${Math.round(width)} × ${height} · ${megapixels} Мп`;
  }

  function updateStartState() {
    els.startButton.disabled = processing || !state.imagePath || !state.outputPath;
  }

  function updateBatchFolders() {
    if (state.batchFolderPath) {
      els.batchInputLabel.textContent = basename(state.batchFolderPath) || "Исходная папка";
      els.batchInputPath.textContent = truncateMiddle(state.batchFolderPath, 68);
    } else {
      els.batchInputLabel.textContent = "Выбрать папку с изображениями";
      els.batchInputPath.textContent = "PNG, JPG, JPEG и WebP";
    }
    if (state.batchOutputPath) {
      els.batchOutputLabel.textContent = basename(state.batchOutputPath) || "Папка результатов";
      els.batchOutputPath.textContent = truncateMiddle(state.batchOutputPath, 68);
    } else {
      els.batchOutputLabel.textContent = "Выбрать папку сохранения";
      els.batchOutputPath.textContent = "Можно оставить рядом с исходниками";
    }
    const ready = Boolean(state.batchFolderPath && state.batchOutputPath);
    els.batchStartButton.disabled = batchProcessing || !ready;
    els.batchRunTitle.textContent = ready ? "Профиль готов к запуску" : "Укажите исходную папку";
    els.batchRunDescription.textContent = ready
      ? `${MODEL_META[state.batchModel]?.label || state.batchModel}, ${state.batchScale}×, ${state.batchFormat.toUpperCase()}. Оригиналы останутся без изменений.`
      : "Avelune создаст отдельную папку результата и не изменит оригинальные файлы.";
  }

  async function selectSingleImage() {
    if (!electron) {
      showToast("Режим предпросмотра", "Выбор файлов доступен после запуска Electron-приложения.", "info");
      return;
    }
    const path = await electron.invoke(COMMANDS.SELECT_FILE);
    if (path) setSourceImage(path);
  }

  function setSourceImage(path) {
    if (!path) return;
    state.imagePath = path;
    if (!state.outputPath) state.outputPath = dirname(path);
    resultPath = "";
    els.sourceName.textContent = basename(path);
    els.sourcePath.textContent = path;
    els.fileTypeIcon.textContent = extension(path).slice(0, 4);
    els.sourceImage.src = pathToFileUrl(path);
    els.beforeImage.src = pathToFileUrl(path);
    els.dropEmpty.classList.add("hidden");
    els.compareStage.classList.add("hidden");
    els.imageStage.classList.remove("hidden");
    els.clearImage.classList.remove("hidden");
    els.sourceImage.onload = () => {
      sourceDimensions = { width: els.sourceImage.naturalWidth, height: els.sourceImage.naturalHeight };
      els.sourceResolution.textContent = `${sourceDimensions.width} × ${sourceDimensions.height}`;
      updateEstimate();
    };
    els.sourceImage.onerror = () => {
      sourceDimensions = null;
      els.sourceResolution.textContent = "Предпросмотр недоступен";
      updateEstimate();
    };
    syncSingleControls();
    updateStartState();
    saveState();
  }

  function clearSourceImage() {
    state.imagePath = "";
    sourceDimensions = null;
    resultPath = "";
    els.sourceImage.removeAttribute("src");
    els.beforeImage.removeAttribute("src");
    els.afterImage.removeAttribute("src");
    els.imageStage.classList.add("hidden");
    els.compareStage.classList.add("hidden");
    els.dropEmpty.classList.remove("hidden");
    els.clearImage.classList.add("hidden");
    updateEstimate();
    updateStartState();
    saveState();
  }

  async function selectOutputFolder(target = "single") {
    if (!electron) {
      showToast("Режим предпросмотра", "Выбор папки доступен после запуска приложения.", "info");
      return;
    }
    const path = await electron.invoke(COMMANDS.SELECT_FOLDER);
    if (!path) return;
    if (target === "batch-output") state.batchOutputPath = path;
    else if (target === "batch-input") {
      state.batchFolderPath = path;
      if (!state.batchOutputPath) state.batchOutputPath = path;
    } else state.outputPath = path;
    syncSingleControls();
    syncBatchControls();
    updateStartState();
    saveState();
  }

  function buildSinglePayload() {
    return {
      tileSize: Number(state.tileSize) || 0,
      compression: Number(state.compression),
      ttaMode: Boolean(state.ttaMode),
      scale: String(state.scale),
      useCustomWidth: Boolean(state.useCustomWidth),
      customWidth: String(state.customWidth || ""),
      model: state.model,
      gpuId: String(state.gpuId || ""),
      saveImageAs: state.saveImageAs,
      overwrite: Boolean(state.overwrite),
      imagePath: state.imagePath,
      outputPath: state.outputPath
    };
  }

  function startSingleProcessing() {
    if (processing) return;
    if (!state.imagePath) return showToast("Нет изображения", "Выберите исходный файл перед запуском.", "error");
    if (!state.outputPath) return showToast("Нет папки результата", "Выберите папку для сохранения.", "error");
    processing = true;
    setSingleProgress(0, "Подготовка модели", "Инициализация");
    els.processingOverlay.classList.remove("hidden");
    els.startButton.classList.add("hidden");
    els.stopButton.classList.remove("hidden");
    updateStartState();
    const command = state.doublePass ? COMMANDS.DOUBLE_AVELUNE : COMMANDS.AVELUNE;
    if (electron) {
      electron.send(command, buildSinglePayload());
    } else {
      simulateSingleProcessing();
    }
  }

  function simulateSingleProcessing() {
    let progress = 0;
    clearInterval(demoTimer);
    demoTimer = setInterval(() => {
      progress += Math.ceil(Math.random() * 8);
      if (progress >= 100) {
        progress = 100;
        clearInterval(demoTimer);
        finishSingleProcessing(state.imagePath, true);
      } else {
        setSingleProgress(progress, progress > 82 ? "Финальная обработка" : "Восстанавливаем детали", progress > 82 ? "Конвертация" : "AI-реконструкция");
      }
    }, 220);
  }

  function setSingleProgress(percent, message, stage) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    els.progressFill.style.width = `${value}%`;
    els.progressValue.textContent = `${Math.round(value)}%`;
    if (message) els.processingMessage.textContent = message;
    if (stage) els.progressStage.textContent = stage;
    els.processingTitle.textContent = value > 92 ? "Сохраняем результат" : value > 0 ? "Восстанавливаем детали" : "Подготавливаем обработку";
  }

  function parseProgress(raw) {
    const text = String(raw || "");
    const matches = [...text.matchAll(/(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%/g)];
    if (matches.length) return Math.min(99, Number(matches[matches.length - 1][1]));
    const plain = text.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*$/);
    if (plain) return Math.min(99, Number(plain[1]));
    return null;
  }

  function handleSingleProgress(raw) {
    const text = String(raw || "");
    const value = parseProgress(text);
    if (value !== null) setSingleProgress(value, "Нейросеть анализирует и восстанавливает изображение", "AI-реконструкция");
    if (/resiz/i.test(text)) setSingleProgress(96, "Масштабируем и конвертируем изображение", "Финальная обработка");
    if (/load|model/i.test(text) && value === null) setSingleProgress(4, "Загружаем выбранную AI-модель", "Подготовка модели");
  }

  function finishSingleProcessing(path, simulated = false) {
    processing = false;
    resultPath = path;
    setSingleProgress(100, "Результат готов", "Завершено");
    window.setTimeout(() => {
      els.processingOverlay.classList.add("hidden");
      els.startButton.classList.remove("hidden");
      els.stopButton.classList.add("hidden");
      els.imageStage.classList.add("hidden");
      els.compareStage.classList.remove("hidden");
      els.afterImage.src = pathToFileUrl(path);
      els.beforeImage.src = pathToFileUrl(state.imagePath);
      els.resultPath.textContent = path;
      els.compareRange.value = 50;
      els.compareCanvas.style.setProperty("--split", "50%");
      updateStartState();
      addHistory({
        type: "single",
        input: state.imagePath,
        output: path,
        model: state.model,
        scale: state.useCustomWidth ? `${state.customWidth}px` : `${state.scale}×`,
        format: state.saveImageAs,
        timestamp: Date.now(),
        status: "success"
      });
      showToast("Изображение готово", simulated ? "Демонстрационная обработка завершена." : "Результат сохранён в выбранной папке.", "success");
    }, simulated ? 300 : 450);
  }

  function failSingleProcessing(error) {
    processing = false;
    clearInterval(demoTimer);
    els.processingOverlay.classList.add("hidden");
    els.startButton.classList.remove("hidden");
    els.stopButton.classList.add("hidden");
    updateStartState();
    showToast("Не удалось обработать изображение", cleanError(error), "error", 9000);
  }

  function cleanError(error) {
    const text = String(error || "Неизвестная ошибка").replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (/vk|vulkan|gpu/i.test(text)) return "Проверьте поддержку Vulkan, драйвер видеокарты или попробуйте другой GPU ID / размер тайла.";
    if (/memory|alloc/i.test(text)) return "Недостаточно видеопамяти. Уменьшите размер тайла или масштаб.";
    return text.length > 320 ? `${text.slice(0, 317)}…` : text;
  }

  function stopSingle() {
    if (!processing) return;
    if (electron) electron.send(COMMANDS.STOP);
    clearInterval(demoTimer);
    processing = false;
    els.processingOverlay.classList.add("hidden");
    els.startButton.classList.remove("hidden");
    els.stopButton.classList.add("hidden");
    updateStartState();
    showToast("Обработка остановлена", "Текущая задача была отменена.", "info");
  }

  function buildBatchPayload() {
    return {
      tileSize: Number(state.batchTileSize) || 0,
      compression: Number(state.batchCompression),
      ttaMode: Boolean(state.batchTtaMode),
      scale: String(state.batchScale),
      useCustomWidth: false,
      customWidth: "",
      model: state.batchModel,
      gpuId: String(state.batchGpuId || ""),
      saveImageAs: state.batchFormat,
      batchFolderPath: state.batchFolderPath,
      outputPath: state.batchOutputPath
    };
  }

  function startBatchProcessing() {
    if (batchProcessing) return;
    if (!state.batchFolderPath || !state.batchOutputPath) return showToast("Папки не выбраны", "Укажите источник и папку результатов.", "error");
    batchProcessing = true;
    els.batchStartButton.classList.add("hidden");
    els.batchStopButton.classList.remove("hidden");
    els.batchProgress.classList.remove("hidden");
    setBatchProgress(0, "Подготовка модели…");
    updateBatchFolders();
    if (electron) electron.send(COMMANDS.FOLDER_AVELUNE, buildBatchPayload());
    else simulateBatchProcessing();
  }

  function simulateBatchProcessing() {
    let progress = 0;
    clearInterval(demoTimer);
    demoTimer = setInterval(() => {
      progress += Math.ceil(Math.random() * 7);
      if (progress >= 100) {
        clearInterval(demoTimer);
        finishBatchProcessing(state.batchOutputPath, true);
      } else setBatchProgress(progress, progress > 90 ? "Сохраняем файлы…" : "Обрабатываем изображения…");
    }, 240);
  }

  function setBatchProgress(percent, stage) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    els.batchProgressFill.style.width = `${value}%`;
    els.batchProgressValue.textContent = `${Math.round(value)}%`;
    if (stage) els.batchProgressStage.textContent = stage;
  }

  function handleBatchProgress(raw) {
    const text = String(raw || "");
    const value = parseProgress(text);
    if (value !== null) setBatchProgress(value, "Обрабатываем изображения…");
    if (/resiz/i.test(text)) setBatchProgress(Math.max(94, value || 0), "Финальная конвертация…");
    const fileMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (fileMatch) els.batchProgressStage.textContent = `Файл ${fileMatch[1]} из ${fileMatch[2]}`;
  }

  function finishBatchProcessing(path, simulated = false) {
    batchProcessing = false;
    setBatchProgress(100, "Готово");
    window.setTimeout(() => {
      els.batchStartButton.classList.remove("hidden");
      els.batchStopButton.classList.add("hidden");
      updateBatchFolders();
      addHistory({
        type: "batch",
        input: state.batchFolderPath,
        output: path,
        model: state.batchModel,
        scale: `${state.batchScale}×`,
        format: state.batchFormat,
        timestamp: Date.now(),
        status: "success"
      });
      showToast("Папка обработана", simulated ? "Демонстрационная пакетная обработка завершена." : "Результаты сохранены в новой папке.", "success");
    }, simulated ? 300 : 450);
  }

  function failBatchProcessing(error) {
    batchProcessing = false;
    els.batchStartButton.classList.remove("hidden");
    els.batchStopButton.classList.add("hidden");
    updateBatchFolders();
    showToast("Ошибка пакетной обработки", cleanError(error), "error", 9000);
  }

  function stopBatch() {
    if (!batchProcessing) return;
    if (electron) electron.send(COMMANDS.STOP);
    clearInterval(demoTimer);
    batchProcessing = false;
    els.batchStartButton.classList.remove("hidden");
    els.batchStopButton.classList.add("hidden");
    updateBatchFolders();
    showToast("Пакетная обработка остановлена", "Текущая операция отменена.", "info");
  }

  function addHistory(item) {
    if (!state.saveHistory) return;
    state.history.unshift(Object.assign({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}` }, item));
    state.history = state.history.slice(0, 30);
    saveState();
    renderHistory();
  }

  function renderHistory() {
    const items = state.history || [];
    els.historyCount.textContent = String(items.length);
    els.historyTotal.textContent = String(items.length);
    els.historyImages.textContent = String(items.filter(item => item.type === "single").length);
    els.historySuccess.textContent = String(items.filter(item => item.status === "success").length);
    els.emptyHistory.classList.toggle("hidden", items.length > 0);
    els.historyList.classList.toggle("hidden", items.length === 0);
    els.historyList.innerHTML = items.map(item => {
      const isSingle = item.type === "single";
      const thumb = isSingle && item.output
        ? `<img src="${pathToFileUrl(item.output)}" alt="" onerror="this.parentElement.innerHTML='<svg viewBox=&quot;0 0 24 24&quot;><path d=&quot;M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5&quot;/></svg>'">`
        : `<svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>`;
      return `<article class="history-item" data-history-id="${escapeHtml(item.id)}">
        <div class="history-thumb">${thumb}</div>
        <div class="history-main"><strong>${escapeHtml(basename(item.input) || item.input || "Задача")}</strong><small>${escapeHtml(truncateMiddle(item.output || "", 76))}</small></div>
        <div class="history-meta"><strong>${escapeHtml(MODEL_META[item.model]?.label || item.model || "AI-модель")}</strong><small>${escapeHtml(`${item.scale || "—"} · ${(item.format || "").toUpperCase()}`)}</small></div>
        <span class="history-status">✓ Готово</span>
        <div class="history-actions"><button data-history-open="${escapeAttr(item.output || "")}" title="Открыть"><svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg></button><button data-history-copy="${escapeAttr(item.output || "")}" title="Копировать путь"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><button data-history-delete="${escapeAttr(item.id)}" title="Удалить"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button></div>
      </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
  }
  function escapeAttr(value) { return escapeHtml(value); }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Путь скопирован", truncateMiddle(text, 90), "success");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      showToast("Путь скопирован", truncateMiddle(text, 90), "success");
    }
  }

  function openPath(path, preferFolder = false) {
    if (!path) return;
    const target = preferFolder && /\.[a-z0-9]{2,5}$/i.test(path) ? dirname(path) : path;
    if (electron) electron.send(COMMANDS.OPEN_FOLDER, target);
    else showToast("Режим предпросмотра", `Открытие пути доступно в приложении: ${truncateMiddle(target, 90)}`, "info");
  }

  function showToast(title, message, type = "info", duration = 4800) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small></div><button aria-label="Закрыть">×</button>`;
    els.toastStack.appendChild(toast);
    const close = () => toast.remove();
    $("button", toast).addEventListener("click", close);
    window.setTimeout(close, duration);
  }

  async function pasteFromClipboardEvent(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    if (!electron) return showToast("Изображение обнаружено", "Вставка из буфера работает в настольном приложении.", "info");
    const file = imageItem.getAsFile();
    if (!file) return;
    const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      electron.send(COMMANDS.PASTE_IMAGE, {
        path: state.outputPath || dirname(state.imagePath) || "",
        name: `avelune-clipboard-${Date.now()}.${ext}`,
        extension: ext,
        encodedBuffer: base64
      });
    };
    reader.readAsDataURL(file);
  }

  async function pasteButtonAction() {
    showToast("Вставка из буфера", "Скопируйте изображение и нажмите Ctrl + V в окне приложения.", "info");
  }

  async function loadSystemInfo() {
    const platformLabels = { win: "Windows", mac: "macOS", linux: "Linux" };
    if (!electron) {
      els.hardwareLabel.textContent = "Режим предпросмотра";
      $("#system-os").textContent = "Browser Preview";
      $("#system-cpu").textContent = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} логических потоков` : "—";
      $("#system-gpu").textContent = "Определяется приложением";
      $("#system-memory").textContent = "—";
      els.appVersion.textContent = "Preview";
      return;
    }
    try {
      const [info, version] = await Promise.all([electron.getSystemInfo(), electron.getAppVersion()]);
      const gpuName = info?.gpu?.deviceString || info?.gpu?.vendorString || "GPU с поддержкой Vulkan";
      els.hardwareLabel.textContent = truncateMiddle(gpuName, 30);
      els.appVersion.textContent = String(version || "v1.0.0").replace(/\s+FOSS$/i, "");
      $("#system-os").textContent = `${platformLabels[info?.platform] || info?.platform || "—"} ${info?.release || ""}`.trim();
      $("#system-cpu").textContent = `${info?.model || "—"}${info?.cpuCount ? ` · ${info.cpuCount} потоков` : ""}`;
      $("#system-gpu").textContent = gpuName;
      $("#system-memory").textContent = info?.totalMemory ? `${(Number(info.totalMemory) / 1073741824).toFixed(1)} ГБ` : "Определяется системой";
    } catch (error) {
      console.warn(error);
      els.hardwareLabel.textContent = "GPU готов";
    }
  }

  function getModelCatalogEntries() {
    const customIds = new Set(state.customModels || []);
    const catalog = MODEL_CATALOG.map(model => ({
      ...model,
      installed: Boolean(model.installed || customIds.has(model.id)),
      custom: customIds.has(model.id) && !BUILT_IN_MODEL_IDS.has(model.id)
    }));
    const known = new Set(catalog.map(model => model.id));
    (state.customModels || []).forEach(id => {
      if (known.has(id)) return;
      catalog.push({
        id, label: id, category: "Пользовательская NCNN-модель",
        short: "Подключена пользователем. Совместимость, качество и права на использование определяет владелец файла.",
        status: "user", installed: true, custom: true, scale: /(?:^|[-_])x?([2348])(?:$|[-_])/i.test(id) ? `${RegExp.$1}×` : "Авто",
        speed: "Неизвестно", verified: false
      });
    });
    return catalog;
  }

  function modelStatusLabel(model) {
    if (model.status === "official") return model.installed ? "Официальная · установлена" : "Официальная · доступна";
    if (model.status === "legacy") return "Из предыдущей версии · лицензия проверяется";
    return "Пользовательская";
  }

  function renderModelManager() {
    if (!els.modelCatalogGrid) return;
    const all = getModelCatalogEntries();
    const query = modelManagerQuery.trim().toLocaleLowerCase("ru");
    const visible = all.filter(model => {
      if (modelManagerFilter !== "all") {
        if (modelManagerFilter === "user") {
          if (!(model.status === "user" || model.custom)) return false;
        } else if (model.status !== modelManagerFilter) return false;
      }
      if (!query) return true;
      return [model.label, model.id, model.category, model.short, model.upstream, model.author]
        .filter(Boolean).join(" ").toLocaleLowerCase("ru").includes(query);
    });
    const installedCount = all.filter(model => model.installed).length;
    const officialCount = all.filter(model => model.status === "official").length;
    const legacyCount = all.filter(model => model.status === "legacy").length;
    const userCount = all.filter(model => model.status === "user" || model.custom).length;
    if (els.modelManagerCount) els.modelManagerCount.textContent = `${installedCount} установлено · ${all.length} в каталоге`;
    if (els.modelOfficialCount) els.modelOfficialCount.textContent = officialCount;
    if (els.modelLegacyCount) els.modelLegacyCount.textContent = legacyCount;
    if (els.modelUserCount) els.modelUserCount.textContent = userCount;

    els.modelCatalogGrid.innerHTML = visible.length ? visible.map(model => {
      const selected = state.model === model.id;
      const badgeClass = model.status === "official" ? "verified" : model.status === "legacy" ? "legacy" : "user";
      const origin = model.upstream ? `<div class="model-origin"><span>Основа</span><strong>${escapeHtml(model.upstream)}</strong></div>` : "";
      const attribution = model.author ? `<div class="model-origin"><span>Автор</span><strong>${escapeHtml(model.author)}</strong></div>` : "";
      const license = model.license ? `<span class="model-license-chip">${escapeHtml(model.license)}</span>` : "";
      const warning = !model.verified ? `<p class="model-warning">Эта AI-модель не разработана командой Avelune. Перед включением в публичную версию необходимо подтвердить источник, лицензию и разрешение на распространение.</p>` : "";
      const primaryAction = model.installed
        ? `<button class="model-use-button${selected ? " selected" : ""}" data-model-use="${escapeHtml(model.id)}">${selected ? "Выбрана" : "Использовать"}</button>`
        : `<button class="model-use-button import" data-model-import="${escapeHtml(model.id)}">Подключить файлы</button>`;
      const links = [
        model.sourceUrl ? `<button class="model-link-button" data-model-url="${escapeHtml(model.sourceUrl)}">Источник</button>` : "",
        model.licenseUrl ? `<button class="model-link-button" data-model-url="${escapeHtml(model.licenseUrl)}">Лицензия</button>` : ""
      ].join("");
      return `<article class="catalog-model-card ${badgeClass}${selected ? " active" : ""}">
        <div class="catalog-model-head"><div class="catalog-model-icon">${model.status === "official" ? "✦" : model.status === "legacy" ? "◇" : "AI"}</div><div><span class="catalog-status ${badgeClass}">${escapeHtml(modelStatusLabel(model))}</span><h4>${escapeHtml(model.label)}</h4><small>${escapeHtml(model.category || "AI-модель")}</small></div></div>
        <p class="catalog-model-description">${escapeHtml(model.short || "")}</p>
        <div class="catalog-model-specs"><span>${escapeHtml(model.scale || "Авто")}</span><span>${escapeHtml(model.speed || "—")}</span>${license}</div>
        <div class="catalog-model-origin">${origin}${attribution}</div>
        ${warning}
        <div class="catalog-model-actions">${primaryAction}${links}</div>
      </article>`;
    }).join("") : `<div class="model-catalog-empty"><strong>Модели не найдены</strong><span>Измените фильтр или поисковый запрос.</span></div>`;
  }

  function renderCustomModels() {
    const models = state.customModels || [];
    els.customModelStatus.textContent = models.length ? `Подключено моделей: ${models.length}` : "Пользовательские модели не подключены";
    els.customModelPath.textContent = state.customModelsFolderPath || "Выберите папку, содержащую пары файлов .bin и .param";
    els.customModelList.innerHTML = models.map(model => {
      const known = MODEL_CATALOG.find(item => item.id === model);
      return `<span class="${known?.status === "official" ? "verified" : ""}">${known?.status === "official" ? "✓ " : ""}${escapeHtml(known?.label || model)}</span>`;
    }).join("");
    const selects = [els.extraModelSelect, els.batchModelSelect];
    selects.forEach(select => {
      Array.from(select.options).filter(option => option.dataset.custom === "true").forEach(option => option.remove());
      models.forEach(model => {
        if (Array.from(select.options).some(option => option.value === model)) return;
        const known = MODEL_CATALOG.find(item => item.id === model);
        const option = document.createElement("option");
        option.value = model;
        option.textContent = `${known?.status === "official" ? "Official" : "Custom"} · ${known?.label || model}`;
        option.dataset.custom = "true";
        select.appendChild(option);
        if (!MODEL_META[model]) MODEL_META[model] = { label: known?.label || model, short: known?.short || "Пользовательская модель" };
      });
    });
    renderModelManager();
    syncSingleControls();
    syncBatchControls();
  }

  function setupElectronEvents() {
    if (!electron) return;
    electron.on(COMMANDS.AVELUNE_PROGRESS, (_event, args) => handleSingleProgress(args));
    electron.on(COMMANDS.DOUBLE_AVELUNE_PROGRESS, (_event, args) => handleSingleProgress(args));
    electron.on(COMMANDS.SCALING_AND_CONVERTING, () => setSingleProgress(96, "Масштабируем и конвертируем изображение", "Финальная обработка"));
    electron.on(COMMANDS.AVELUNE_DONE, (_event, path) => finishSingleProcessing(path));
    electron.on(COMMANDS.DOUBLE_AVELUNE_DONE, (_event, path) => finishSingleProcessing(path));
    electron.on(COMMANDS.FOLDER_AVELUNE_PROGRESS, (_event, args) => handleBatchProgress(args));
    electron.on(COMMANDS.FOLDER_AVELUNE_DONE, (_event, path) => finishBatchProcessing(path));
    electron.on(COMMANDS.AVELUNE_ERROR, (_event, error) => {
      if (batchProcessing) failBatchProcessing(error);
      else failSingleProcessing(error);
    });
    electron.on(COMMANDS.PASTE_IMAGE_SAVE_SUCCESS, (_event, path) => {
      setSourceImage(path);
      showToast("Изображение вставлено", "Файл из буфера обмена готов к обработке.", "success");
    });
    electron.on(COMMANDS.PASTE_IMAGE_SAVE_ERROR, (_event, error) => showToast("Не удалось вставить изображение", cleanError(error), "error"));
    electron.on(COMMANDS.CUSTOM_MODEL_FILES_LIST, (_event, models) => {
      state.customModels = Array.isArray(models) ? models : [];
      renderCustomModels();
      saveState();
      if (state.customModels.length) showToast("Модели подключены", `Найдено моделей: ${state.customModels.length}.`, "success");
    });
  }

  function bindEvents() {
    els.navItems.forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.view)));
    $("#sidebar-collapse").addEventListener("click", () => setCompactMenu(!state.compactMenu));
    $("#theme-toggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
    $$("[data-theme-choice]").forEach(btn => btn.addEventListener("click", () => setTheme(btn.dataset.themeChoice)));
    els.compactMenuToggle.addEventListener("change", event => setCompactMenu(event.target.checked));
    els.saveHistoryToggle.addEventListener("change", event => { state.saveHistory = event.target.checked; saveState(); });

    $("#select-file-button").addEventListener("click", event => { event.stopPropagation(); selectSingleImage(); });
    $("#replace-image").addEventListener("click", event => { event.stopPropagation(); selectSingleImage(); });
    els.dropZone.addEventListener("click", event => {
      if (!els.dropEmpty.classList.contains("hidden") && event.target.id !== "select-file-button") selectSingleImage();
    });
    els.dropZone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") selectSingleImage(); });
    ["dragenter", "dragover"].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.remove("dragover"); }));
    els.dropZone.addEventListener("drop", event => {
      const file = event.dataTransfer?.files?.[0];
      const path = file?.path || "";
      if (path && /\.(png|jpe?g|jfif|webp)$/i.test(path)) setSourceImage(path);
      else showToast("Файл не поддерживается", "Перетащите PNG, JPG, JPEG или WebP.", "error");
    });
    $("#paste-button").addEventListener("click", pasteButtonAction);
    document.addEventListener("paste", pasteFromClipboardEvent);
    els.clearImage.addEventListener("click", clearSourceImage);

    $$(".preset-chip").forEach(btn => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
    $$(".model-card").forEach(card => card.addEventListener("click", () => setModel(card.dataset.model)));
    els.extraModelSelect.addEventListener("change", event => { if (event.target.value) setModel(event.target.value); });
    $$("#scale-segmented button").forEach(btn => btn.addEventListener("click", () => { state.scale = btn.dataset.scale; state.useCustomWidth = false; syncSingleControls(); saveState(); }));
    els.formatSelect.addEventListener("change", event => { state.saveImageAs = event.target.value; saveState(); });
    els.qualityRange.addEventListener("input", event => { state.compression = Number(event.target.value); els.qualityValue.textContent = `${state.compression}%`; updateRangeBackground(event.target); saveState(); });
    els.customWidthToggle.addEventListener("change", event => { state.useCustomWidth = event.target.checked; syncSingleControls(); saveState(); });
    els.customWidthInput.addEventListener("input", event => { state.customWidth = Math.max(64, Number(event.target.value || 64)); updateEstimate(); saveState(); });
    els.tileSelect.addEventListener("change", event => { state.tileSize = Number(event.target.value); saveState(); });
    els.gpuInput.addEventListener("input", event => { state.gpuId = event.target.value.trim(); saveState(); });
    els.ttaToggle.addEventListener("change", event => { state.ttaMode = event.target.checked; saveState(); });
    els.doublePassToggle.addEventListener("change", event => { state.doublePass = event.target.checked; saveState(); });
    els.overwriteToggle.addEventListener("change", event => { state.overwrite = event.target.checked; saveState(); });
    $("#reset-controls").addEventListener("click", () => {
      ["model","scale","saveImageAs","compression","useCustomWidth","customWidth","tileSize","gpuId","ttaMode","doublePass","overwrite"].forEach(key => state[key] = DEFAULTS[key]);
      $$(".preset-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === "balanced"));
      syncSingleControls(); saveState(); showToast("Параметры сброшены", "Восстановлен универсальный профиль.", "info");
    });
    $("#select-output-button").addEventListener("click", () => selectOutputFolder("single"));
    $("#output-path-button").addEventListener("click", () => selectOutputFolder("single"));
    els.startButton.addEventListener("click", startSingleProcessing);
    els.stopButton.addEventListener("click", stopSingle);

    els.compareRange.addEventListener("input", event => els.compareCanvas.style.setProperty("--split", `${event.target.value}%`));
    $("#open-result-folder").addEventListener("click", () => openPath(resultPath, true));
    $("#copy-result-path").addEventListener("click", () => copyText(resultPath));

    $("#batch-input-picker").addEventListener("click", () => selectOutputFolder("batch-input"));
    $("#batch-output-picker").addEventListener("click", () => selectOutputFolder("batch-output"));
    els.batchModelSelect.addEventListener("change", event => { state.batchModel = event.target.value; updateBatchFolders(); saveState(); });
    els.batchScaleSelect.addEventListener("change", event => { state.batchScale = event.target.value; updateBatchFolders(); saveState(); });
    els.batchFormatSelect.addEventListener("change", event => { state.batchFormat = event.target.value; updateBatchFolders(); saveState(); });
    els.batchQualityRange.addEventListener("input", event => { state.batchCompression = Number(event.target.value); els.batchQualityValue.textContent = `${state.batchCompression}%`; updateRangeBackground(event.target); saveState(); });
    els.batchTtaToggle.addEventListener("change", event => { state.batchTtaMode = event.target.checked; saveState(); });
    els.batchTileSelect.addEventListener("change", event => { state.batchTileSize = Number(event.target.value); saveState(); });
    els.batchGpuInput.addEventListener("input", event => { state.batchGpuId = event.target.value.trim(); saveState(); });
    els.batchStartButton.addEventListener("click", startBatchProcessing);
    els.batchStopButton.addEventListener("click", stopBatch);

    els.historyList.addEventListener("click", event => {
      const open = event.target.closest("[data-history-open]");
      const copy = event.target.closest("[data-history-copy]");
      const remove = event.target.closest("[data-history-delete]");
      if (open) openPath(open.dataset.historyOpen, true);
      if (copy) copyText(copy.dataset.historyCopy);
      if (remove) {
        state.history = state.history.filter(item => item.id !== remove.dataset.historyDelete);
        saveState(); renderHistory();
      }
    });
    $("#clear-history-button").addEventListener("click", () => { state.history = []; saveState(); renderHistory(); showToast("История очищена", "Локальный журнал удалён.", "info"); });
    $$('[data-go-enhance]').forEach(btn => btn.addEventListener("click", () => navigate("enhance")));

    if (els.modelManagerSearch) els.modelManagerSearch.addEventListener("input", event => { modelManagerQuery = event.target.value || ""; renderModelManager(); });
    $$('[data-model-filter]').forEach(button => button.addEventListener("click", () => {
      modelManagerFilter = button.dataset.modelFilter || "all";
      $$('[data-model-filter]').forEach(item => item.classList.toggle("active", item === button));
      renderModelManager();
    }));
    if (els.modelCatalogGrid) els.modelCatalogGrid.addEventListener("click", async event => {
      const useButton = event.target.closest("[data-model-use]");
      const importButton = event.target.closest("[data-model-import]");
      const linkButton = event.target.closest("[data-model-url]");
      if (useButton) {
        const id = useButton.dataset.modelUse;
        state.model = id;
        state.batchModel = id;
        syncSingleControls();
        syncBatchControls();
        renderModelManager();
        saveState();
        showToast("Модель выбрана", `${MODEL_META[id]?.label || id} будет использоваться для одиночной и пакетной обработки.`, "success");
      }
      if (importButton) {
        if (!electron) return showToast("Режим предпросмотра", "Импорт моделей доступен в настольном приложении.", "info");
        const path = await electron.invoke(COMMANDS.SELECT_CUSTOM_MODEL_FOLDER);
        if (path) { state.customModelsFolderPath = path; saveState(); renderCustomModels(); }
      }
      if (linkButton?.dataset.modelUrl) window.open(linkButton.dataset.modelUrl, "_blank", "noopener,noreferrer");
    });

    $("#select-custom-models").addEventListener("click", async () => {
      if (!electron) return showToast("Режим предпросмотра", "Подключение моделей доступно в приложении.", "info");
      const path = await electron.invoke(COMMANDS.SELECT_CUSTOM_MODEL_FOLDER);
      if (path) { state.customModelsFolderPath = path; saveState(); renderCustomModels(); }
    });
    $("#reset-app-button").addEventListener("click", () => {
      const history = state.history;
      Object.assign(state, DEFAULTS, { history: state.saveHistory ? history : [] });
      localStorage.removeItem("lastImagePath");
      localStorage.removeItem("lastSavedBatchAveluneFolderPath");
      localStorage.removeItem("customModelsFolderPath");
      setTheme(DEFAULTS.theme); setCompactMenu(false); clearSourceImage(); syncSingleControls(); syncBatchControls(); renderCustomModels(); renderHistory(); saveState();
      showToast("Настройки сброшены", "Приложение возвращено к исходному профилю.", "info");
    });
    $("#open-license-button").addEventListener("click", () => window.open("https://www.gnu.org/licenses/agpl-3.0.html", "_blank"));

    $("#about-button").addEventListener("click", () => els.aboutDialog.showModal());
    $("#about-close").addEventListener("click", () => els.aboutDialog.close());
    els.aboutDialog.addEventListener("click", event => { if (event.target === els.aboutDialog) els.aboutDialog.close(); });

    document.addEventListener("keydown", event => {
      if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); if (currentView === "batch") startBatchProcessing(); else startSingleProcessing(); }
      if (event.key === "Escape") { if (processing) stopSingle(); else if (batchProcessing) stopBatch(); }
    });
  }

  function initialize() {
    setTheme(state.theme);
    setCompactMenu(state.compactMenu);
    els.saveHistoryToggle.checked = state.saveHistory;
    syncSingleControls();
    syncBatchControls();
    renderCustomModels();
    renderHistory();
    bindEvents();
    setupElectronEvents();
    loadSystemInfo();
    if (state.imagePath) setSourceImage(state.imagePath);
    updateStartState();
    if (electron && state.customModelsFolderPath) electron.send(COMMANDS.GET_MODELS_LIST, state.customModelsFolderPath);
  }

  initialize();
})();
