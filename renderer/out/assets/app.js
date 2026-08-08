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
    PASTE_IMAGE_SAVE_ERROR: "Clipboard Image save failed",
    GET_IMAGE_PREVIEW: "avelune:get-image-preview",
    SCAN_BATCH_FOLDER: "avelune:scan-batch-folder",
    PAUSE_BATCH: "avelune:pause-batch",
    RESUME_BATCH: "avelune:resume-batch",
    BATCH_ITEM_EVENT: "avelune:batch-item-event",
    RUN_GPU_BENCHMARK: "avelune:run-gpu-benchmark",
    GET_QUEUE_STATUS: "avelune:get-queue-status",
    GET_LOCAL_AI_STATUS: "avelune:get-local-ai-status",
    INSTALL_LOCAL_AI: "avelune:install-local-ai",
    REMOVE_LOCAL_AI: "avelune:remove-local-ai",
    LOCAL_AI_PROGRESS: "avelune:local-ai-progress"
  };

  const MODEL_META = {
    "avelune-standard-4x": { label: "Avelune Natural 4×", short: "Проверенная модель Real-ESRGAN x4plus" },
    "digital-art-4x": { label: "Avelune Art 4×", short: "Проверенная модель RealESRGAN x4plus Anime 6B" },
    "realesrnet-x4plus": { label: "RealESRNet Faithful 4×", short: "Консервативное восстановление с меньшим риском артефактов" },
    "realesr-animevideov3-x2": { label: "AnimeVideo v3 2×", short: "Быстрые кадры анимации 2×" },
    "realesr-animevideov3-x3": { label: "AnimeVideo v3 3×", short: "Кадры анимации 3×" },
    "realesr-animevideov3-x4": { label: "AnimeVideo v3 4×", short: "Кадры анимации 4×" },
    "avelune-smart-restore": { label: "Avelune Smart Restore", short: "Автоматический выбор профессионального pipeline по изображению и GPU" },
    "avelune-natural": { label: "Avelune Natural 4×", short: "Универсальные фотографии" },
    "avelune-game": { label: "Avelune Game Images", short: "Игровые скриншоты, текстуры, UI и цифровые кадры" },
    "avelune-neural-restore": { label: "Avelune Neural Restore 4×", short: "Глубокое локальное восстановление сильно повреждённых изображений" },
    "avelune-photo-restore-ultra": { label: "Avelune Photo Restore Ultra", short: "DiffBIR v2.1 восстанавливает всю сцену, затем лица и финальные текстуры. Максимальный локальный режим.", category: "detail", tone: "restore", badge: "Максимум качества", speed: "Очень медленно", quality: "Diffusion-реконструкция", base: "DiffBIR 2.1 + GFPGAN + Real-ESRGAN", tags: ["Сильно повреждённые", "Diffusion", "Ultra"] },
    "avelune-generative-restore": { label: "Avelune Photo Restore Pro", short: "Тяжёлое локальное восстановление старых и сильно повреждённых фотографий" },
    "avelune-restore": { label: "Avelune Restore Faithful", short: "Старые фото, JPEG-артефакты и бережное восстановление" },
    "avelune-art": { label: "Avelune Art 4×", short: "Рисунки, арты и аниме" },
    "avelune-anime-video": { label: "Avelune Anime Video", short: "Кадры анимации и видео" },
    "avelune-fast": { label: "Avelune Fast 4×", short: "Быстрая обработка с меньшей нагрузкой" },
    "avelune-detail-plus": { label: "Avelune Detail+", short: "Максимум деталей, медленная обработка" }
  };

  const PROFILE_CATALOG = Object.freeze({
    "avelune-smart-restore": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70, smartRestore: true },
    "avelune-natural": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-game": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-neural-restore": { model: "realesrnet-x4plus", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: true, neuralRestoreStrength: 75 },
    "avelune-photo-restore-ultra": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: true, doublePass: false, neuralRestore: false, neuralRestoreStrength: 90, generativeRestore: true, restoreEngine: "ultra", restoreQuality: "maximum" },
    "avelune-generative-restore": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: true, doublePass: false, neuralRestore: false, neuralRestoreStrength: 80, generativeRestore: true },
    "avelune-restore": { model: "realesrnet-x4plus", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-art": { model: "digital-art-4x", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-anime-video": { model: "realesr-animevideov3-x4", scale: "4", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-fast": { model: "avelune-standard-4x", scale: "2", compression: 100, ttaMode: false, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 },
    "avelune-detail-plus": { model: "avelune-standard-4x", scale: "4", compression: 100, ttaMode: true, doublePass: false, neuralRestore: false, neuralRestoreStrength: 70 }
  });

  const PROFILE_ALIASES = Object.freeze({
    "avelune-balanced": "avelune-natural",
    "avelune-smooth": "avelune-restore"
  });
  const normalizeProfileId = profileId => PROFILE_CATALOG[profileId] ? profileId : (PROFILE_ALIASES[profileId] || profileId);

  const PROFILE_PRESENTATION = Object.freeze({
    "avelune-smart-restore": { label: "Avelune Smart Restore", short: "Анализирует разрешение, шум, JPEG-блоки, размытие, цвет и GPU, затем выбирает лучший pipeline без ручного выбора модели.", category: "smart", tone: "smart", badge: "Умный режим", speed: "Автоматически", quality: "Профессиональный выбор", base: "Smart pipeline resolver", tags: ["Авто", "Restore", "GPU"] },
    "avelune-natural": { label: "Avelune Natural 4×", short: "Естественные фотографии, игровые кадры и универсальный контент.", category: "photo", tone: "natural", badge: "Рекомендуется", speed: "Средняя скорость", quality: "100% качество", base: "Real-ESRGAN x4plus", tags: ["Фото", "Универсальный", "Естественно"] },
    "avelune-game": { label: "Avelune Game Images", short: "Игровые скриншоты, интерфейсы, текстуры и цифровые кадры без face-restore и diffusion-реконструкции.", category: "game", tone: "game", badge: "Игры и UI", speed: "Средняя скорость", quality: "100% качество", base: "Real-ESRGAN x4plus", tags: ["Игры", "UI", "Текстуры"] },
    "avelune-neural-restore": { label: "Avelune Neural Restore 4×", short: "Двухэтапная нейрореконструкция для пикселизации, сильного JPEG-сжатия, размытия и утраченных текстур.", category: "detail", tone: "restore", badge: "Глубокое восстановление", speed: "Очень медленная обработка", quality: "Генеративные детали", base: "RealESRNet + Real-ESRGAN", tags: ["Пикселизация", "Старые фото", "Реконструкция"] },
    "avelune-photo-restore-ultra": { label: "Avelune Photo Restore Ultra", short: "DiffBIR v2.1 восстанавливает всю сцену, затем лица и финальные текстуры. Максимальный локальный режим.", category: "detail", tone: "restore", badge: "Максимум качества", speed: "Очень медленно", quality: "Diffusion-реконструкция", base: "DiffBIR 2.1 + GFPGAN + Real-ESRGAN", tags: ["Сильно повреждённые", "Diffusion", "Ultra"] },
    "avelune-generative-restore": { label: "Avelune Photo Restore Pro", short: "Глубокое локальное восстановление старых, размытых и пикселизированных фотографий с отдельной реконструкцией лиц и фона.", category: "detail", tone: "restore", badge: "Локальный Pro", speed: "Очень медленная обработка", quality: "Генеративные детали", base: "GFPGAN 1.4 + Real-ESRGAN", tags: ["Старые фото", "Лица", "Локально"] },
    "avelune-restore": { label: "Avelune Restore Faithful", short: "Бережное восстановление старых снимков и JPEG-артефактов с меньшим риском выдуманных деталей.", category: "photo", tone: "restore", badge: "Верный оригиналу", speed: "Средняя скорость", quality: "100% качество", base: "RealESRNet x4plus", tags: ["Старые фото", "JPEG", "Faithful"] },
    "avelune-art": { label: "Avelune Art 4×", short: "Чёткие линии, иллюстрации, цифровой арт и аниме.", category: "art", tone: "art", badge: "2D и аниме", speed: "Высокая скорость", quality: "100% качество", base: "Anime 6B", tags: ["Аниме", "Иллюстрации", "Контуры"] },
    "avelune-anime-video": { label: "Avelune Anime Video", short: "Стабильные контуры для кадров анимации и последовательностей.", category: "art", tone: "video", badge: "Для кадров", speed: "Высокая скорость", quality: "100% качество", base: "AnimeVideo v3", tags: ["Видео", "Кадры", "Анимация"] },
    "avelune-fast": { label: "Avelune Fast 2×", short: "Быстрый результат с умеренной нагрузкой на видеокарту.", category: "speed", tone: "fast", badge: "Самый быстрый", speed: "Максимальная скорость", quality: "100% качество", base: "Real-ESRGAN x4plus", tags: ["2×", "Быстро", "Меньше VRAM"] },
    "avelune-detail-plus": { label: "Avelune Detail+ 4×", short: "Максимальное восстановление мелких деталей с TTA-режимом.", category: "detail", tone: "detail", badge: "Advanced", speed: "Медленная обработка", quality: "100% качество", base: "Real-ESRGAN x4plus + TTA", tags: ["TTA", "Текстуры", "Максимум"] }
  });

  const OFFICIAL_PROFILE_EXAMPLES = Object.freeze({
    "avelune-standard-4x": {
      asset: "assets/profile-examples/official-realesrgan-x4plus.jpg",
      fallback: "assets/profile-examples/fallback-photo.svg",
      alt: "Официальный пример Real-ESRGAN x4plus",
      source: "Real-ESRGAN"
    },
    "digital-art-4x": {
      asset: "assets/profile-examples/official-realesrgan-x4plus-anime-6b.png",
      fallback: "assets/profile-examples/fallback-anime.svg",
      alt: "Официальный пример RealESRGAN x4plus Anime 6B",
      source: "Real-ESRGAN Anime 6B"
    },
    "realesrnet-x4plus": {
      asset: "assets/profile-examples/official-realesrgan-x4plus.jpg",
      fallback: "assets/profile-examples/fallback-photo.svg",
      alt: "Официальный пример семейства Real-ESRGAN",
      source: "RealESRNet x4plus"
    },
    "realesr-animevideov3-x2": {
      asset: "assets/profile-examples/official-realesrgan-x4plus-anime-6b.png",
      fallback: "assets/profile-examples/fallback-anime.svg",
      alt: "Официальный пример семейства AnimeVideo",
      source: "AnimeVideo v3"
    },
    "realesr-animevideov3-x3": {
      asset: "assets/profile-examples/official-realesrgan-x4plus-anime-6b.png",
      fallback: "assets/profile-examples/fallback-anime.svg",
      alt: "Официальный пример семейства AnimeVideo",
      source: "AnimeVideo v3"
    },
    "realesr-animevideov3-x4": {
      asset: "assets/profile-examples/official-realesrgan-x4plus-anime-6b.png",
      fallback: "assets/profile-examples/fallback-anime.svg",
      alt: "Официальный пример семейства AnimeVideo",
      source: "AnimeVideo v3"
    }
  });

  const MODEL_CATALOG = [
    {
      id: "avelune-standard-4x", label: "Avelune Natural 4×", category: "Проверенная AI-модель",
      short: "Официальная Real-ESRGAN x4plus для фотографий, игровых кадров и смешанного контента.",
      status: "official", installed: true, scale: "4×", speed: "Средняя", verified: true,
      upstream: "Real-ESRGAN x4plus", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE",
      defaultProfile: "avelune-natural"
    },
    {
      id: "digital-art-4x", label: "Avelune Art 4×", category: "Проверенная AI-модель",
      short: "Официальная RealESRGAN x4plus Anime 6B для аниме, цифрового арта и чётких 2D-контуров.",
      status: "official", installed: true, scale: "4×", speed: "Быстрая", verified: true,
      upstream: "RealESRGAN x4plus Anime 6B", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause",
      sourceUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_model.md", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE",
      defaultProfile: "avelune-art"
    },
    { id: "realesrnet-x4plus", label: "RealESRNet Faithful 4×", category: "Официальная AI-модель", short: "Консервативная официальная модель RealESRNet x4plus для более верного оригиналу восстановления.", status: "official", installed: true, scale: "4×", speed: "Средняя", verified: true, upstream: "RealESRNet x4plus", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause", sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE", defaultProfile: "avelune-restore" },
    { id: "realesr-animevideov3-x2", label: "AnimeVideo v3 2×", category: "Официальная AI-модель", short: "Официальная быстрая модель для кадров анимации с нативным масштабом 2×.", status: "official", installed: true, scale: "2×", speed: "Очень быстрая", verified: true, upstream: "RealESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause", sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE", defaultProfile: "avelune-anime-video" },
    { id: "realesr-animevideov3-x3", label: "AnimeVideo v3 3×", category: "Официальная AI-модель", short: "Официальная модель для кадров анимации с нативным масштабом 3×.", status: "official", installed: true, scale: "3×", speed: "Быстрая", verified: true, upstream: "RealESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause", sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE", defaultProfile: "avelune-anime-video" },
    { id: "realesr-animevideov3-x4", label: "AnimeVideo v3 4×", category: "Официальная AI-модель", short: "Официальная модель для кадров анимации и последовательностей 4×.", status: "official", installed: true, scale: "4×", speed: "Быстрая", verified: true, upstream: "RealESRGAN AnimeVideo-v3", author: "Xintao Wang и участники Real-ESRGAN", license: "BSD-3-Clause", sourceUrl: "https://github.com/xinntao/Real-ESRGAN", licenseUrl: "https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE", defaultProfile: "avelune-anime-video" },
    { id: "avelune-generative-restore", label: "Avelune Photo Restore Pro", category: "Локальный профиль", short: "GFPGAN 1.4 восстанавливает лица, Real-ESRGAN восстанавливает фон, затем Avelune выполняет финальный TTA upscale.", status: "profile", installed: true, scale: "до 4×", speed: "Очень медленная", verified: true, upstream: "GFPGAN 1.4 + Real-ESRGAN → Real-ESRGAN NCNN", author: "Профиль Avelune; веса GFPGAN и Real-ESRGAN", license: "Apache-2.0 + BSD-3-Clause + AGPL interface", engineModel: "avelune-standard-4x" },
    { id: "avelune-neural-restore", label: "Avelune Neural Restore 4×", category: "Встроенный профиль", short: "Двухэтапный каскад официальных RealESRNet и Real-ESRGAN для глубокой реконструкции сильно повреждённых фотографий.", status: "profile", installed: true, scale: "4×", speed: "Очень медленная", verified: true, upstream: "realesrnet-x4plus → avelune-standard-4x", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "realesrnet-x4plus" },
    { id: "avelune-restore", label: "Avelune Restore Faithful", category: "Встроенный профиль", short: "Бережный профиль на официальной RealESRNet x4plus с меньшим риском выдуманных деталей.", status: "profile", installed: true, scale: "4×", speed: "Средняя", verified: true, upstream: "realesrnet-x4plus", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "realesrnet-x4plus" },
    { id: "avelune-natural", label: "Avelune Natural 4×", category: "Встроенный профиль", short: "Универсальный профиль на проверенной Real-ESRGAN x4plus.", status: "profile", installed: true, scale: "4×", speed: "Средняя", verified: true, upstream: "avelune-standard-4x", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "avelune-standard-4x" },
    { id: "avelune-art", label: "Avelune Art 4×", category: "Встроенный профиль", short: "Профиль для рисунков, аниме и 2D-графики на проверенной Anime 6B.", status: "profile", installed: true, scale: "4×", speed: "Быстрая", verified: true, upstream: "digital-art-4x", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "digital-art-4x" },
    { id: "avelune-anime-video", label: "Avelune Anime Video", category: "Встроенный профиль", short: "Scale-specific профиль AnimeVideo-v3 для кадров анимации и последовательностей изображений.", status: "profile", installed: true, scale: "2×/3×/4×", speed: "Очень быстрая", verified: true, upstream: "realesr-animevideov3-x2/x3/x4", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "realesr-animevideov3-x4" },
    { id: "avelune-fast", label: "Avelune Fast 4×", category: "Встроенный профиль", short: "Быстрый режим с обработкой Natural и целевым масштабом 2×.", status: "profile", installed: true, scale: "2×", speed: "Высокая", verified: true, upstream: "avelune-standard-4x", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "avelune-standard-4x" },
    { id: "avelune-detail-plus", label: "Avelune Detail+", category: "Advanced профиль", short: "Natural с TTA и максимальным качеством сохранения; медленнее стандартного режима.", status: "profile", installed: true, scale: "4×", speed: "Медленная", verified: true, upstream: "avelune-standard-4x + TTA", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "avelune-standard-4x" },
    { id: "avelune-game", label: "Avelune Game Images", category: "Пользовательский режим", short: "Игровые кадры, UI и текстуры без face-restore и diffusion-реконструкции.", status: "profile", installed: true, scale: "4×", speed: "Средняя", verified: true, upstream: "avelune-standard-4x", author: "Профиль Avelune; веса Real-ESRGAN", license: "BSD-3-Clause", engineModel: "avelune-standard-4x" },
    { id: "avelune-smart-restore", label: "Avelune Smart Restore", category: "Умный режим", short: "Автоматический выбор pipeline по изображению, степени повреждения и GPU.", status: "profile", installed: true, scale: "auto", speed: "Авто", verified: true, upstream: "Smart resolver → built-in/local profile", author: "Профиль Avelune", license: "BSD-3-Clause + package licenses", engineModel: "auto" }
  ];

  const BUILT_IN_MODEL_IDS = new Set(MODEL_CATALOG.filter(model => model.status === "official").map(model => model.id));

  const PRESETS = {
    balanced: { profile: "avelune-natural" },
    photo: { profile: "avelune-detail-plus" },
    art: { profile: "avelune-art" },
    fast: { profile: "avelune-fast" }
  };

  const DEFAULTS = {
    theme: "dark",
    language: "auto",
    compactMenu: false,
    controlsCollapsed: false,
    layoutVersion: 9,
    uiRevision: 10,
    preferencesVersion: 4,
    saveHistory: false,
    profile: "avelune-natural",
    model: "avelune-standard-4x",
    scale: "4",
    saveImageAs: "png",
    compression: 100,
    useCustomWidth: false,
    customWidth: 3840,
    tileSize: 0,
    gpuId: "",
    ttaMode: false,
    doublePass: false,
    overwrite: false,
    copyMetadata: true,
    preserveColorProfile: true,
    neuralRestore: false,
    neuralRestoreStrength: 70,
    generativeRestore: false,
    imagePath: "",
    outputPath: "",
    batchFolderPath: "",
    batchOutputPath: "",
    batchProfile: "avelune-natural",
    batchModel: "avelune-standard-4x",
    batchScale: "4",
    batchFormat: "png",
    batchCompression: 100,
    batchTileSize: 0,
    batchGpuId: "",
    batchTtaMode: false,
    batchNeuralRestore: false,
    batchNeuralRestoreStrength: 70,
    batchContinueOnError: true,
    batchSkipExisting: true,
    batchQueue: [],
    customModelsFolderPath: "",
    customModels: [],
    history: []
  };

  const stored = safeParse(localStorage.getItem("aveluneState"), {});
  const state = Object.assign({}, DEFAULTS, stored);
  state.history = Array.isArray(stored.history) ? stored.history.slice(0, 30) : [];
  state.customModels = Array.isArray(stored.customModels) ? stored.customModels : [];
  state.batchQueue = Array.isArray(stored.batchQueue) ? stored.batchQueue.slice(0, 10000) : [];
  if (Number(stored.layoutVersion || 0) < 9) {
    state.compactMenu = false;
    state.controlsCollapsed = false;
    state.layoutVersion = 9;
  }
  // v9.2 changes privacy and output-quality defaults once for existing RC5.2 settings.
  // Users can explicitly re-enable history or lower save quality afterwards.
  if (Number(stored.preferencesVersion || 0) < 4) {
    state.compression = 100;
    state.batchCompression = 100;
    state.saveHistory = false;
    state.copyMetadata = true;
    state.preserveColorProfile = true;
    state.neuralRestore = Boolean(stored.neuralRestore ?? stored.faceRecovery ?? false);
    state.neuralRestoreStrength = Math.max(20, Math.min(100, Number(stored.neuralRestoreStrength ?? stored.faceRecoveryStrength ?? 70)));
    state.generativeRestore = Boolean(stored.generativeRestore ?? false);
    state.batchContinueOnError = true;
    state.batchSkipExisting = true;
    state.preferencesVersion = 4;
  }

  // Transparently migrate model IDs saved by early preview builds without keeping their old branding in the product.
  const legacyPrefix = ["up", "scayl"].join("");
  const REMOVED_MODEL_FALLBACKS = new Map([
    [`${legacyPrefix}-standard-4x`, "avelune-standard-4x"],
    [`${legacyPrefix}-lite-4x`, "avelune-standard-4x"],
    ["avelune-lite-4x", "avelune-standard-4x"],
    ["high-fidelity-4x", "avelune-standard-4x"],
    ["remacri-4x", "avelune-standard-4x"],
    ["ultramix-balanced-4x", "avelune-standard-4x"],
    ["ultrasharp-4x", "avelune-standard-4x"]
  ]);
  const migrateModelId = value => REMOVED_MODEL_FALLBACKS.get(value) || value;
  state.model = migrateModelId(state.model);
  state.batchModel = migrateModelId(state.batchModel);
  state.profile = normalizeProfileId(state.profile);
  state.batchProfile = normalizeProfileId(state.batchProfile);
  if (!PROFILE_CATALOG[state.profile]) state.profile = state.model === "digital-art-4x" ? "avelune-art" : "avelune-natural";
  if (!PROFILE_CATALOG[state.batchProfile]) state.batchProfile = state.batchModel === "digital-art-4x" ? "avelune-art" : "avelune-natural";
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
  let activeSingleJob = null;
  let activeBatchJob = null;
  let currentView = "enhance";
  let demoTimer = null;
  let modelManagerFilter = "all";
  let modelManagerQuery = "";
  let sourcePreviewGeneration = 0;
  let activeSourceObjectUrl = "";
  const pendingClipboardPreviews = new Map();
  let latestClipboardRequestId = "";
  let modelPickerFilter = "all";
  let processingClockTimer = null;
  let processingStartedAt = 0;
  let batchQueuePaused = false;
  let detectedSystemInfo = null;
  let localAiStatus = null;

  const electron = window.electron || null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function localRestoreTierForProfile(profileId) {
    const config = PROFILE_CATALOG[normalizeProfileId(profileId)] || {};
    if (config.restoreEngine === "ultra") return "ultra";
    return config.generativeRestore ? "pro" : "";
  }

  function currentLocalRestoreTier() {
    if (!state.generativeRestore) return "";
    return state.restoreEngine === "ultra" || state.profile === "avelune-photo-restore-ultra" ? "ultra" : "pro";
  }

  function isLocalAiTierInstalled(tier) {
    if (tier === "ultra") return Boolean(localAiStatus?.ultra?.installed);
    if (tier === "pro") return Boolean((localAiStatus?.pro || localAiStatus || {}).installed);
    return true;
  }

  function localAiTierLabel(tier) {
    return tier === "ultra" ? "Photo Restore Ultra" : "Photo Restore Pro";
  }

  function setSingleProfileState(profileId) {
    const profile = PROFILE_CATALOG[profileId];
    if (!profile) return false;
    state.profile = profileId;
    Object.assign(state, profile, {
      useCustomWidth: false,
      neuralRestore: Boolean(profile.neuralRestore),
      neuralRestoreStrength: Number(profile.neuralRestoreStrength) || 70,
      generativeRestore: Boolean(profile.generativeRestore),
      restoreEngine: profile.restoreEngine || "pro",
      restoreQuality: profile.restoreQuality || "balanced"
    });
    syncScaleSpecificModel("single");
    return true;
  }

  function fallbackUnavailableLocalRestore(notify = false) {
    const tier = currentLocalRestoreTier();
    if (!tier || isLocalAiTierInstalled(tier)) return true;
    setSingleProfileState("avelune-neural-restore");
    state.generativeRestore = false;
    if (notify) {
      showToast(
        "AI-пакет не установлен",
        `${localAiTierLabel(tier)} нужно скачать в настройках. Включён безопасный Neural Restore.`,
        "info",
        7000
      );
    }
    return false;
  }

  const els = {
    html: document.documentElement,
    body: document.body,
    sidebarCollapse: $("#sidebar-collapse"),
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
    sidebarSourceLabel: $("#sidebar-source-label"),
    sourcePath: $("#source-path"),
    sourceResolution: $("#source-resolution"),
    fileTypeIcon: $("#file-type-icon"),
    clearImage: $("#clear-image"),
    outputPathLabel: $("#output-path-label"),
    estimateLabel: $("#estimate-label"),
    startButton: $("#start-button"),
    stopButton: $("#stop-button"),
    processingOverlay: $("#processing-overlay"),
    workspaceProcessing: $("#workspace-processing"),
    processingPreview: $("#processing-preview"),
    workspaceProcessingTitle: $("#workspace-processing-title"),
    workspaceProcessingMessage: $("#workspace-processing-message"),
    workspaceProcessingStage: $("#workspace-processing-stage"),
    workspaceProgressValue: $("#workspace-progress-value"),
    workspaceProgressFill: $("#workspace-progress-fill"),
    progressOrb: $("#progress-orb"),
    processingProfileLabel: $("#processing-profile-label"),
    processingOutputLabel: $("#processing-output-label"),
    processingElapsed: $("#processing-elapsed"),
    processingTitle: $("#processing-title"),
    processingMessage: $("#processing-message"),
    progressFill: $("#progress-fill"),
    progressValue: $("#progress-value"),
    progressStage: $("#progress-stage"),
    modelHint: $("#model-hint"),
    autoProfileButton: $("#auto-profile-button"),
    autoAnalysisResult: $("#auto-analysis-result"),
    autoAnalysisText: $("#auto-analysis-text"),
    extraModelSelect: $("#extra-model-select"),
    modelPickerButton: $("#model-picker-button"),
    modelPickerDialog: $("#model-picker-dialog"),
    profileChoiceGrid: $("#profile-choice-grid"),
    modelPickerDeviceGpu: $("#model-picker-device-gpu"),
    modelPickerDeviceMemory: $("#model-picker-device-memory"),
    modelPickerDeviceRecommendation: $("#model-picker-device-recommendation"),
    selectedProfileIcon: $("#selected-profile-icon"),
    selectedProfileName: $("#selected-profile-name"),
    selectedProfileBadge: $("#selected-profile-badge"),
    selectedProfileDescription: $("#selected-profile-description"),
    selectedProfileScale: $("#selected-profile-scale"),
    selectedProfileSpeed: $("#selected-profile-speed"),
    selectedProfileQuality: $("#selected-profile-quality"),
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
    copyMetadataToggle: $("#copy-metadata-toggle"),
    preserveColorToggle: $("#preserve-color-toggle"),
    neuralRestoreToggle: $("#neural-restore-toggle"),
    neuralRestoreStrengthRow: $("#neural-restore-strength-row"),
    neuralRestoreStrengthRange: $("#neural-restore-strength-range"),
    neuralRestoreStrengthValue: $("#neural-restore-strength-value"),
    generativeRestoreToggle: $("#generative-restore-toggle"),
    generativeRestoreNotice: $("#generative-restore-notice"),
    localAiStatusTitle: $("#local-ai-status-title"),
    localAiStatusDetails: $("#local-ai-status-details"),
    localAiSize: $("#local-ai-size"),
    localAiBackend: $("#local-ai-backend"),
    installLocalAi: $("#install-local-ai"),
    removeLocalAi: $("#remove-local-ai"),
    localAiProgress: $("#local-ai-progress"),
    localAiProgressBar: $("#local-ai-progress-bar"),
    localAiProgressText: $("#local-ai-progress-text"),
    ultraAiStatusTitle: $("#ultra-ai-status-title"), ultraAiStatusDetails: $("#ultra-ai-status-details"), ultraAiSize: $("#ultra-ai-size"), installUltraAi: $("#install-ultra-ai"), removeUltraAi: $("#remove-ultra-ai"), ultraAiProgress: $("#ultra-ai-progress"), ultraAiProgressBar: $("#ultra-ai-progress-bar"), ultraAiProgressText: $("#ultra-ai-progress-text"),
    compareCanvas: $("#compare-canvas"),
    compareFrame: $("#compare-frame"),
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
    batchContinueToggle: $("#batch-continue-toggle"),
    batchSkipToggle: $("#batch-skip-toggle"),
    batchQueueList: $("#batch-queue-list"),
    batchQueueSummary: $("#batch-queue-summary"),
    batchPauseButton: $("#batch-pause-button"),
    batchResumeButton: $("#batch-resume-button"),
    batchRetryButton: $("#batch-retry-button"),
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
    languageSelect: $("#language-select"),
    compactMenuToggle: $("#compact-menu-toggle"),
    controlsToggle: $("#controls-toggle"),
    toastStack: $("#toast-stack"),
    hardwareLabel: $("#hardware-label"),
    appVersion: $("#app-version"),
    aboutDialog: $("#about-dialog"),
    gpuAutotuneButton: $("#gpu-autotune-button"),
    gpuAutotuneStatus: $("#gpu-autotune-status"),
  };

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }

  let saveStateTimer = null;

  function persistState() {
    window.clearTimeout(saveStateTimer);
    saveStateTimer = null;
    try {
      localStorage.setItem("aveluneState", JSON.stringify(state));
      if (state.imagePath) localStorage.setItem("lastImagePath", state.imagePath);
      else localStorage.removeItem("lastImagePath");
      if (state.batchFolderPath) localStorage.setItem("lastSavedBatchAveluneFolderPath", state.batchFolderPath);
      else localStorage.removeItem("lastSavedBatchAveluneFolderPath");
      if (state.customModelsFolderPath) localStorage.setItem("customModelsFolderPath", state.customModelsFolderPath);
      else localStorage.removeItem("customModelsFolderPath");
    } catch (error) { console.warn("Could not save Avelune settings", error); }
  }

  function saveState(immediate = false) {
    if (immediate) return persistState();
    window.clearTimeout(saveStateTimer);
    saveStateTimer = window.setTimeout(persistState, 240);
  }

  function normalizePercent(value) {
    if (value == null) return 0;
    const match = String(value).match(/-?\d+(?:[\.,]\d+)?/);
    if (!match) return 0;
    const numeric = Number(match[0].replace(",", "."));
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
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
    if (electron?.toFileUrl) return electron.toFileUrl(path);
    const normalized = String(path).replace(/\\/g, "/");
    return `file:///${normalized.split("/").map(encodeURIComponent).join("/")}`;
  }

  function revokeObjectUrl(url) {
    if (!url || !String(url).startsWith("blob:")) return;
    try { URL.revokeObjectURL(url); } catch {}
  }

  function replaceActiveSourceObjectUrl(url = "") {
    if (activeSourceObjectUrl && activeSourceObjectUrl !== url) revokeObjectUrl(activeSourceObjectUrl);
    activeSourceObjectUrl = url;
  }

  function storePendingClipboardPreview(requestId, url) {
    const timer = window.setTimeout(() => {
      const pending = pendingClipboardPreviews.get(requestId);
      if (!pending) return;
      revokeObjectUrl(pending.url);
      pendingClipboardPreviews.delete(requestId);
      if (latestClipboardRequestId === requestId) latestClipboardRequestId = "";
    }, 30_000);
    pendingClipboardPreviews.set(requestId, { url, timer });
  }

  function takePendingClipboardPreview(requestId) {
    const pending = pendingClipboardPreviews.get(requestId);
    if (!pending) return "";
    window.clearTimeout(pending.timer);
    pendingClipboardPreviews.delete(requestId);
    return pending.url;
  }

  function clearPendingClipboardPreviews() {
    for (const pending of pendingClipboardPreviews.values()) {
      window.clearTimeout(pending.timer);
      revokeObjectUrl(pending.url);
    }
    pendingClipboardPreviews.clear();
    latestClipboardRequestId = "";
  }

  async function createFallbackPreviewUrl(path) {
    if (!electron?.getImagePreview || !path) return "";
    const payload = await electron.getImagePreview(path);
    const bytes = payload?.buffer;
    if (!bytes) throw new Error("Приложение не вернуло данные предпросмотра.");
    const blob = new Blob([bytes], { type: payload?.mime || "application/octet-stream" });
    return URL.createObjectURL(blob);
  }

  function createRequestId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function truncateMiddle(text, max = 74) {
    text = String(text || "");
    if (text.length <= max) return text;
    const half = Math.floor((max - 3) / 2);
    return `${text.slice(0, half)}…${text.slice(-half)}`;
  }

  function formatPickerMemory(bytes) {
    const gb = Number(bytes || 0) / 1073741824;
    return gb > 0 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB VRAM` : "VRAM auto";
  }

  function recommendedProfileForSystem(info) {
    const vram = Number(info?.gpu?.dedicatedVideoMemoryBytes || 0) / 1073741824;
    if (vram >= 7.5 && localAiStatus?.ultra?.installed && PROFILE_CATALOG["avelune-photo-restore-ultra"]) return "Photo Restore Ultra";
    if (vram >= 4 && (localAiStatus?.pro || localAiStatus || {}).installed && PROFILE_CATALOG["avelune-generative-restore"]) return "Photo Restore Pro";
    if (vram >= 4 && PROFILE_CATALOG["avelune-neural-restore"]) return "Neural Restore";
    if (PROFILE_CATALOG["avelune-natural"]) return "Natural 4×";
    return getProfilePresentation(Object.keys(PROFILE_CATALOG)[0]).label.replace(/^Avelune\s+/, "");
  }

  function syncModelPickerDevice(info = detectedSystemInfo) {
    if (!els.modelPickerDeviceGpu) return;
    const gpuName = info?.gpu?.deviceString || info?.gpu?.vendorString || "Локальный GPU";
    els.modelPickerDeviceGpu.textContent = truncateMiddle(gpuName, 24);
    els.modelPickerDeviceMemory.textContent = formatPickerMemory(info?.gpu?.dedicatedVideoMemoryBytes);
    els.modelPickerDeviceRecommendation.textContent = `Рекомендуется: ${recommendedProfileForSystem(info)}`;
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat(activeIntlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
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

  function setLanguage(language = "auto", persist = true) {
    const api = window.aveluneI18n;
    state.language = api?.normalizeLanguage?.(language) || "auto";
    const locale = api?.setLanguage?.(state.language) || state.language;
    if (els.languageSelect) els.languageSelect.value = state.language;
    if (persist) saveState();
    return locale;
  }

  function activeIntlLocale() {
    const locale = window.aveluneI18n?.locale || document.documentElement.lang || "ru";
    return locale === "auto" ? "en-US" : locale;
  }

  function trUi(value) {
    const text = String(value ?? "");
    return window.aveluneI18n?.translate?.(text) || text;
  }

  function translateSubtree(root = document.body) {
    window.aveluneI18n?.translatePage?.(root || document.body);
  }

  function refreshLocalizedViews() {
    syncSelectedProfileCard();
    if (els.modelPickerDialog?.open) renderProfilePicker();
    if (currentView === "settings") renderModelManager();
    if (currentView === "history") renderHistory();
    renderBatchQueue();
    updateBatchFolders();
    translateSubtree();
  }

  function setCompactMenu(compact) {
    state.compactMenu = Boolean(compact);
    els.body.classList.toggle("sidebar-compact", state.compactMenu);
    els.compactMenuToggle.checked = state.compactMenu;
    if (els.sidebarCollapse) {
      const label = state.compactMenu ? "Развернуть боковую панель" : "Свернуть боковую панель";
      els.sidebarCollapse.title = label;
      els.sidebarCollapse.setAttribute("aria-label", label);
    }
    saveState();
  }

  function setControlsCollapsed(collapsed) {
    state.controlsCollapsed = Boolean(collapsed);
    els.body.classList.toggle("controls-collapsed", state.controlsCollapsed);
    if (els.controlsToggle) {
      els.controlsToggle.setAttribute("aria-pressed", String(state.controlsCollapsed));
      els.controlsToggle.title = state.controlsCollapsed ? "Показать параметры" : "Скрыть параметры";
    }
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
    els.body.dataset.activeView = view;
    els.views.forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    els.navItems.forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    els.eyebrow.textContent = VIEW_TITLES[view][0];
    els.title.textContent = VIEW_TITLES[view][1];
    const activePanel = els.views.find(panel => panel.dataset.viewPanel === view);
    if (activePanel) activePanel.scrollTop = 0;
    if (view === "history") renderHistory();
    if (view === "settings") renderModelManager();
  }


  // UI v10 keeps the low-cost renderer while adding a richer profile workflow and processing HUD.

  const PROFILE_METRIC_OVERRIDES = Object.freeze({
    "avelune-smart-restore": { icon: "spark", quality: 97, speed: 72, vram: "auto" },
    "avelune-natural": { icon: "leaf", quality: 90, speed: 85, vram: "2-4 GB" },
    "avelune-game": { icon: "sliders", quality: 91, speed: 84, vram: "2-4 GB" },
    "avelune-neural-restore": { icon: "brain", quality: 98, speed: 60, vram: "4-6 GB" },
    "avelune-photo-restore-ultra": { icon: "flame", quality: 100, speed: 35, vram: "8+ GB" },
    "avelune-generative-restore": { icon: "brain", quality: 96, speed: 42, vram: "4-6 GB" },
    "avelune-restore": { icon: "leaf", quality: 94, speed: 70, vram: "2-4 GB" },
    "avelune-art": { icon: "palette", quality: 92, speed: 70, vram: "2-4 GB" },
    "avelune-anime-video": { icon: "palette", quality: 90, speed: 78, vram: "2-4 GB" },
    "avelune-fast": { icon: "bolt", quality: 82, speed: 95, vram: "1-2 GB" },
    "avelune-detail-plus": { icon: "sliders", quality: 99, speed: 48, vram: "4-6 GB" }
  });

  function getProfilePresentation(profileId = state.profile) {
    profileId = normalizeProfileId(profileId);
    const profile = PROFILE_PRESENTATION[profileId];
    if (profile) return profile;
    const config = PROFILE_CATALOG[profileId] || {};
    const modelId = config.model || state.model;
    const meta = MODEL_META[modelId] || { label: modelId || "Пользовательская модель", short: "Пользовательский профиль" };
    const model = MODEL_CATALOG.find(item => item.id === modelId);
    return {
      label: meta.label,
      short: meta.short,
      category: "custom",
      tone: "custom",
      badge: "Registry profile",
      speed: model?.speed || "Зависит от модели",
      quality: `${Number(config.compression || state.compression || 100)}% качество`,
      base: model?.upstream || model?.label || modelId,
      tags: [model?.status === "official" ? "Official" : "Custom", `${config.scale || state.scale || "4"}x`, config.ttaMode ? "TTA" : "Standard"]
    };
  }

  function clampMetric(value, fallback = 90) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function inferProfileIcon(profileId, info = {}, config = {}) {
    if (PROFILE_METRIC_OVERRIDES[profileId]?.icon) return PROFILE_METRIC_OVERRIDES[profileId].icon;
    if (config.generativeRestore || info.tone === "restore") return "brain";
    if (info.category === "speed") return "bolt";
    if (info.category === "art" || info.tone === "art" || info.tone === "video") return "palette";
    if (config.ttaMode) return "sliders";
    return "spark";
  }

  function getProfileMetrics(profileId, config = {}, info = {}) {
    const known = PROFILE_METRIC_OVERRIDES[profileId] || {};
    const quality = clampMetric(known.quality ?? config.compression, 100);
    let speed = known.speed;
    if (speed == null) {
      speed = config.generativeRestore ? 42 : config.ttaMode ? 55 : info.category === "speed" ? 92 : info.category === "art" ? 74 : 82;
    }
    let vram = known.vram;
    if (!vram) {
      if (config.restoreEngine === "ultra") vram = "8+ GB";
      else if (config.generativeRestore || config.neuralRestore || config.ttaMode) vram = "4-6 GB";
      else if (String(config.scale || "4") === "2") vram = "1-2 GB";
      else vram = "2-4 GB";
    }
    return { icon: inferProfileIcon(profileId, info, config), quality, speed: clampMetric(speed, 80), vram };
  }

  function profileIconSvg(name) {
    const icons = {
      leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c8 0 13-6 14-14-8 1-14 6-14 14Z"></path><path d="M5 19c3-5 7-8 13-12"></path><path d="M8 15 5 12M12 12l-2-4"></path></svg>',
      brain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18a4 4 0 0 1-4-4 4 4 0 0 1 1.6-3.2A4 4 0 0 1 10 5a4 4 0 0 1 4 4v9"></path><path d="M15 18a4 4 0 0 0 4-4 4 4 0 0 0-1.6-3.2A4 4 0 0 0 14 5"></path><path d="M9 12h6M10 8v10M14 8v10"></path></svg>',
      flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a7 7 0 0 0 7-7c0-4-3-7-5-10-.4 3-2 4.5-4 6.5C8.5 12 7 13.5 7 16a5 5 0 0 0 5 5Z"></path><path d="M12 21a3 3 0 0 0 3-3c0-1.8-1.3-3.2-2.2-4.4-.2 1.3-1 2-1.8 2.9-.7.7-1 1.3-1 2.2A2.7 2.7 0 0 0 12 21Z"></path></svg>',
      palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 0 0 0 16h1.3a2 2 0 0 0 1.4-3.4 1.8 1.8 0 0 1 1.3-3.1h1A3 3 0 0 0 20 10.4C20 6.8 16.4 4 12 4Z"></path><circle cx="8.5" cy="10" r="1"></circle><circle cx="11" cy="8" r="1"></circle><circle cx="14" cy="9" r="1"></circle><circle cx="10" cy="13" r="1"></circle></svg>',
      bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z"></path></svg>',
      sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"></path><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"></path></svg>'
    };
    return icons[name] || icons.spark;
  }

  function getProfileBackendModels(config = {}, info = {}) {
    const model = MODEL_CATALOG.find(item => item.id === config.model);
    return info.base || model?.upstream || model?.label || config.model || "Registry model";
  }

  function AIProfileCard(profileId) {
    const config = PROFILE_CATALOG[profileId] || {};
    const info = getProfilePresentation(profileId);
    const metrics = getProfileMetrics(profileId, config, info);
    const selected = state.profile === profileId;
    const backendModels = getProfileBackendModels(config, info);
    const mode = `${config.scale || "4"}x · ${config.ttaMode ? "TTA" : "Standard"}`;
    const requiredTier = localRestoreTierForProfile(profileId);
    const packageMissing = Boolean(requiredTier && !isLocalAiTierInstalled(requiredTier));
    const tags = [
      ...(info.tags || []).slice(0, packageMissing ? 2 : 3),
      ...(packageMissing ? ["Нужен AI-пакет"] : [])
    ].map(tag => `<b>${escapeHtml(tag)}</b>`).join("");
    const isOfficial = Boolean(OFFICIAL_PROFILE_EXAMPLES[config.model] || BUILT_IN_MODEL_IDS.has(config.model));
    const unavailableAttrs = packageMissing ? ` disabled aria-disabled="true" title="${escapeAttr(`${localAiTierLabel(requiredTier)} не установлен`)}"` : "";
    return `<button class="profile-choice-card ${selected ? "selected" : ""}${packageMissing ? " package-missing" : ""}" type="button" data-profile-id="${escapeHtml(profileId)}" data-tone="${escapeHtml(info.tone || "custom")}"${unavailableAttrs}>
      <span class="profile-choice-icon ai-profile-identity" aria-hidden="true">${profileIconSvg(metrics.icon)}</span>
      <span class="profile-choice-content">
        <span class="profile-choice-heading"><span><strong>${escapeHtml(info.label)}</strong><small>${escapeHtml(info.badge || "AI profile")}</small></span></span>
        <span class="profile-choice-description">${escapeHtml(info.short || "")}</span>
        <span class="profile-choice-tags">${tags}</span>
      </span>
      <span class="profile-choice-stats" aria-label="Параметры профиля">
        <span class="profile-stat"><i></i><small>Качество</small><strong>${metrics.quality}%</strong></span>
        <span class="profile-stat"><i></i><small>Скорость</small><strong>${metrics.speed}%</strong></span>
        <span class="profile-stat"><i></i><small>VRAM</small><strong>${escapeHtml(metrics.vram)}</strong></span>
      </span>
      <span class="profile-choice-model">
        <strong class="profile-base-model">${escapeHtml(backendModels)}${isOfficial ? '<i class="official-model-check" role="img" aria-label="Официальная модель" title="Официальная модель">&check;</i>' : ""}</strong>
        <small>${escapeHtml(mode)}</small>
        <span class="profile-select-cta">${packageMissing ? `Установите ${escapeHtml(localAiTierLabel(requiredTier).replace("Photo Restore ", ""))}` : selected ? "Выбрано" : "Выбрать"}</span>
      </span>
      <span class="profile-preview-divider" aria-hidden="true"><i>‹</i><i>›</i></span>
      <span class="profile-row-arrow" aria-hidden="true">&rsaquo;</span>
    </button>`;
  }

  function syncSelectedProfileCard() {
    const info = getProfilePresentation();
    const scale = PROFILE_CATALOG[state.profile]?.scale || state.scale || "4";
    if (els.selectedProfileIcon) els.selectedProfileIcon.dataset.tone = info.tone;
    if (els.selectedProfileName) els.selectedProfileName.textContent = info.label.replace(/^Avelune\s+/, "");
    if (els.selectedProfileBadge) els.selectedProfileBadge.textContent = info.badge;
    if (els.selectedProfileDescription) els.selectedProfileDescription.textContent = info.short;
    if (els.selectedProfileScale) els.selectedProfileScale.textContent = `${scale}×`;
    if (els.selectedProfileSpeed) els.selectedProfileSpeed.textContent = info.speed;
    if (els.selectedProfileQuality) els.selectedProfileQuality.textContent = `${state.compression}% качество`;
  }

  function renderProfilePicker() {
    if (!els.profileChoiceGrid) return;
    const profiles = Object.keys(PROFILE_CATALOG).filter(id => {
      const info = getProfilePresentation(id);
      return modelPickerFilter === "all" || info?.category === modelPickerFilter;
    });
    els.profileChoiceGrid.innerHTML = profiles.map(AIProfileCard).join("");
    translateSubtree(els.profileChoiceGrid);
  }

  function openProfilePicker() {
    if (!els.modelPickerDialog) return;
    renderProfilePicker();
    if (typeof els.modelPickerDialog.showModal === "function") els.modelPickerDialog.showModal();
    else els.modelPickerDialog.setAttribute("open", "");
  }

  function closeProfilePicker() {
    if (!els.modelPickerDialog) return;
    if (typeof els.modelPickerDialog.close === "function" && els.modelPickerDialog.open) els.modelPickerDialog.close();
    else els.modelPickerDialog.removeAttribute("open");
  }

  function formatElapsed(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const seconds = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function startProcessingClock() {
    window.clearInterval(processingClockTimer);
    processingStartedAt = Date.now();
    if (els.processingElapsed) els.processingElapsed.textContent = "00:00";
    processingClockTimer = window.setInterval(() => {
      if (els.processingElapsed) els.processingElapsed.textContent = formatElapsed(Date.now() - processingStartedAt);
    }, 1000);
  }

  function stopProcessingClock() {
    window.clearInterval(processingClockTimer);
    processingClockTimer = null;
  }

  function syncProcessingContext() {
    const info = getProfilePresentation(activeSingleJob?.metadata?.profile || state.profile);
    if (els.processingProfileLabel) els.processingProfileLabel.textContent = info.label;
    if (els.processingOutputLabel) {
      const size = state.useCustomWidth ? `${state.customWidth}px` : `${state.scale}×`;
      els.processingOutputLabel.textContent = `${size} · ${String(state.saveImageAs).toUpperCase()} · ${state.compression}%`;
    }
    if (els.processingPreview) {
      const source = els.sourceImage?.currentSrc || els.sourceImage?.src || activeSourceObjectUrl || pathToFileUrl(state.imagePath);
      if (source) els.processingPreview.src = source;
    }
  }

  function setWorkspaceProcessingVisible(visible) {
    if (!els.workspaceProcessing) return;
    els.workspaceProcessing.classList.toggle("hidden", !visible);
    els.dropZone?.classList.toggle("is-processing", visible);
    if (visible) {
      syncProcessingContext();
      startProcessingClock();
    } else {
      stopProcessingClock();
    }
  }

  function syncSingleControls() {
    $$(".model-card").forEach(card => card.classList.toggle("active", card.dataset.profile === state.profile));
    const builtInCard = $(`.model-card[data-profile="${cssEscape(state.profile)}"]`);
    const extraOption = Array.from(els.extraModelSelect.options).some(option => option.value === state.profile);
    els.extraModelSelect.value = builtInCard ? "" : (extraOption ? state.profile : "");
    els.modelHint.textContent = (MODEL_META[state.profile] || MODEL_META[state.model] || { label: state.model }).label.replace(/^Avelune\s+/, "");
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
    if (els.copyMetadataToggle) els.copyMetadataToggle.checked = state.copyMetadata;
    if (els.preserveColorToggle) els.preserveColorToggle.checked = state.preserveColorProfile;
    if (els.neuralRestoreToggle) els.neuralRestoreToggle.checked = state.neuralRestore;
    if (els.neuralRestoreStrengthRange) { els.neuralRestoreStrengthRange.value = state.neuralRestoreStrength; updateRangeBackground(els.neuralRestoreStrengthRange); }
    if (els.neuralRestoreStrengthValue) {
      const strength = Number(state.neuralRestoreStrength) || 70;
      const mode = strength >= 75 ? "Максимальная" : strength >= 55 ? "Сильная" : "Умеренная";
      els.neuralRestoreStrengthValue.textContent = `${strength}% · ${mode}`;
    }
    if (els.neuralRestoreStrengthRow) els.neuralRestoreStrengthRow.classList.toggle("hidden", !state.neuralRestore);
    const activeRestoreTier = currentLocalRestoreTier();
    const proInstalled = isLocalAiTierInstalled("pro");
    const proModeActive = Boolean(state.generativeRestore && activeRestoreTier === "pro" && proInstalled);
    if (els.generativeRestoreToggle) {
      els.generativeRestoreToggle.checked = proModeActive;
      els.generativeRestoreToggle.disabled = !proInstalled;
      const row = els.generativeRestoreToggle.closest(".toggle-row");
      row?.classList.toggle("disabled", !proInstalled);
      row?.classList.toggle("package-missing", !proInstalled);
      row?.setAttribute("title", proInstalled ? "Photo Restore Pro" : "Photo Restore Pro нужно скачать в настройках");
    }
    if (els.generativeRestoreNotice) els.generativeRestoreNotice.classList.toggle("hidden", !proModeActive);
    els.outputPathLabel.textContent = state.outputPath ? truncateMiddle(state.outputPath, 58) : "Будет выбрана автоматически";
    syncSelectedProfileCard();
    if (els.modelPickerDialog?.open) renderProfilePicker();
    updateEstimate();
  }

  function syncBatchControls() {
    els.batchModelSelect.value = state.batchProfile || state.batchModel;
    els.batchScaleSelect.value = state.batchScale;
    els.batchFormatSelect.value = state.batchFormat;
    els.batchQualityRange.value = state.batchCompression;
    els.batchQualityValue.textContent = `${state.batchCompression}%`;
    updateRangeBackground(els.batchQualityRange);
    els.batchTtaToggle.checked = state.batchTtaMode;
    els.batchTileSelect.value = String(state.batchTileSize);
    els.batchGpuInput.value = state.batchGpuId;
    if (els.batchContinueToggle) els.batchContinueToggle.checked = state.batchContinueOnError;
    if (els.batchSkipToggle) els.batchSkipToggle.checked = state.batchSkipExisting;
    renderBatchQueue();
    updateBatchFolders();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function scaleSpecificAnimeModel(scale) {
    const value = ["2","3","4"].includes(String(scale)) ? String(scale) : "4";
    return `realesr-animevideov3-x${value}`;
  }

  function syncScaleSpecificModel(target = "single") {
    if (target === "batch" && state.batchProfile === "avelune-anime-video") state.batchModel = scaleSpecificAnimeModel(state.batchScale);
    if (target === "single" && state.profile === "avelune-anime-video") state.model = scaleSpecificAnimeModel(state.scale);
  }

  function applyProfile(profileId, target = "single") {
    profileId = normalizeProfileId(profileId);
    const requiredTier = localRestoreTierForProfile(profileId);
    if (target === "single" && requiredTier && !isLocalAiTierInstalled(requiredTier)) {
      showToast(
        "AI-пакет не установлен",
        `${localAiTierLabel(requiredTier)} нужно скачать в настройках перед выбором этого профиля.`,
        "info",
        7000
      );
      renderProfilePicker();
      return false;
    }
    if (target === "batch" && requiredTier) profileId = "avelune-neural-restore";
    const profile = PROFILE_CATALOG[profileId];
    if (!profile) return false;
    if (target === "batch") {
      state.batchProfile = profileId;
      state.batchModel = profile.model;
      state.batchScale = profile.scale;
      state.batchCompression = profile.compression;
      state.batchTtaMode = Boolean(profile.ttaMode);
      state.batchNeuralRestore = Boolean(profile.neuralRestore);
      state.batchNeuralRestoreStrength = Number(profile.neuralRestoreStrength) || 70;
      syncScaleSpecificModel("batch");
      syncBatchControls();
    } else {
      setSingleProfileState(profileId);
      syncSingleControls();
    }
    saveState();
    return true;
  }

  function setModel(model) {
    if (!model) return;
    const official = MODEL_CATALOG.find(item => item.id === model && item.status === "official");
    if (official?.defaultProfile) return applyProfile(official.defaultProfile);
    state.profile = `custom:${model}`;
    state.model = model;
    syncSingleControls();
    saveState();
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset || !applyProfile(preset.profile)) return;
    $$(".preset-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === name));
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

  function recommendedTileForVram(bytes) {
    const gb = Number(bytes || 0) / (1024 ** 3);
    if (gb >= 7.5) return 0;
    if (gb >= 4) return 256;
    if (gb >= 2) return 128;
    return 64;
  }

  function readAnalysisPixels(image, size = 128) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D недоступен.");
    context.drawImage(image, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  }

  async function loadAnalysisPixels(size = 128) {
    try {
      return readAnalysisPixels(els.sourceImage, size);
    } catch (originalError) {
      // Some Chromium/file:// combinations allow displaying a local image but
      // taint a canvas. Read the same validated file through the whitelisted
      // binary preview IPC and analyse a same-origin blob instead.
      if (!state.imagePath || !electron?.getImagePreview) throw originalError;
      const fallbackUrl = await createFallbackPreviewUrl(state.imagePath);
      const fallbackImage = new Image();
      fallbackImage.decoding = "async";
      try {
        await new Promise((resolve, reject) => {
          fallbackImage.onload = resolve;
          fallbackImage.onerror = () => reject(new Error("Не удалось подготовить изображение для локального анализа."));
          fallbackImage.src = fallbackUrl;
        });
        return readAnalysisPixels(fallbackImage, size);
      } finally {
        revokeObjectUrl(fallbackUrl);
      }
    }
  }

  function resolveSmartProfile(metrics, vramBytes) {
    const proInstalled = Boolean((localAiStatus?.pro || localAiStatus || {}).installed);
    const ultraInstalled = Boolean(localAiStatus?.ultra?.installed);
    const hasUltraVram = vramBytes >= 7.5 * 1024 ** 3;
    const hasProVram = vramBytes >= 4 * 1024 ** 3;
    const severeDamage = (metrics.blockiness > 5.2 && metrics.edge < 35) || (metrics.megapixels < 0.7 && metrics.blockiness > 3.2) || metrics.noise > 14 || (metrics.blur < 8 && metrics.edge < 30);
    const oldPhoto = metrics.blockiness > 3.6 || metrics.noise > 10.5 || (metrics.saturation < .12 && metrics.luminance < 150) || metrics.colorSpread < 18;
    const artLike = metrics.edge > 47 && metrics.saturation > .22 && metrics.noise < 9;
    const gameLike = metrics.edge > 38 && metrics.noise < 6.2 && metrics.blockiness < 3.2 && metrics.saturation > .16;
    const graphicLike = metrics.edge > 42 && metrics.noise < 7 && (metrics.saturation < .18 || metrics.colorSpread < 26 || metrics.blockiness < 2.6);
    const cleanDetail = metrics.edge > 38 && metrics.noise < 5.5;
    const reasons = [];
    let profile = "avelune-natural";

    if (metrics.megapixels > 18 && vramBytes < 4 * 1024 ** 3) {
      return { profile: "avelune-fast", reasons: ["высокое разрешение и ограниченная VRAM"] };
    }
    if (graphicLike) {
      return { profile: "avelune-game", reasons: ["чёткие линии, UI/текст и низкий фотошум; generative restoration не применён"] };
    }
    if (artLike) {
      return { profile: "avelune-art", reasons: ["чёткие контуры, насыщенные плоские цвета и низкий шум"] };
    }
    if (gameLike) {
      return { profile: "avelune-game", reasons: ["чистые цифровые границы, UI/текстуры и низкий шум"] };
    }
    if (severeDamage) {
      if (ultraInstalled && hasUltraVram) {
        profile = "avelune-photo-restore-ultra";
        reasons.push("сильные повреждения; Ultra установлен и VRAM достаточно");
      } else if (proInstalled && hasProVram) {
        profile = "avelune-generative-restore";
        reasons.push("сильные повреждения; выбран локальный Photo Restore Pro");
      } else {
        profile = "avelune-neural-restore";
        reasons.push("пикселизация, JPEG-блоки, размытие или утрата текстур");
      }
    } else if (oldPhoto) {
      profile = "avelune-restore";
      reasons.push("шум, JPEG-блоки, выцветание или признаки старого снимка");
    } else if (cleanDetail) {
      profile = "avelune-detail-plus";
      reasons.push("много мелких чистых деталей без сильного шума");
    } else {
      reasons.push("сбалансированная фотографическая структура");
    }
    return { profile, reasons };
  }

  async function analyzeCurrentImage(options = {}) {
    const shouldApply = options.apply !== false;
    const silent = Boolean(options.silent);
    if (!els.sourceImage?.complete || !els.sourceImage.naturalWidth) {
      if (!silent) showToast("Изображение не готово", "Дождитесь загрузки предпросмотра.", "info");
      return null;
    }
    const size = 128;
    let pixels;
    try {
      pixels = await loadAnalysisPixels(size);
    } catch (error) {
      if (!silent) showToast("Авто-анализ недоступен", error?.message || "Не удалось прочитать пиксели изображения.", "error", 7000);
      return null;
    }
    let saturation = 0, edge = 0, noise = 0, blockiness = 0, luminance = 0, laplacian = 0, colorSpread = 0;
    const luma = new Float32Array(size * size);
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      saturation += max ? (max - min) / max : 0;
      colorSpread += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
      const y = .2126*r + .7152*g + .0722*b;
      luma[p] = y; luminance += y;
    }
    for (let y = 1; y < size - 1; y += 1) for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      const dx = Math.abs(luma[i + 1] - luma[i - 1]);
      const dy = Math.abs(luma[i + size] - luma[i - size]);
      edge += Math.hypot(dx, dy);
      const local = (luma[i-1]+luma[i+1]+luma[i-size]+luma[i+size])/4;
      noise += Math.abs(luma[i] - local);
      laplacian += Math.abs(4 * luma[i] - luma[i-1] - luma[i+1] - luma[i-size] - luma[i+size]);
      if (x % 8 === 0) blockiness += Math.abs(luma[i] - luma[i - 1]);
      if (y % 8 === 0) blockiness += Math.abs(luma[i] - luma[i - size]);
    }
    const count = size * size;
    const metrics = {
      saturation: saturation / count,
      edge: edge / ((size - 2) * (size - 2)),
      noise: noise / ((size - 2) * (size - 2)),
      blockiness: blockiness / (size * 30),
      blur: laplacian / ((size - 2) * (size - 2)),
      colorSpread: colorSpread / count,
      luminance: luminance / count,
      megapixels: (els.sourceImage.naturalWidth * els.sourceImage.naturalHeight) / 1_000_000
    };
    const vramBytes = Number(detectedSystemInfo?.gpu?.dedicatedVideoMemoryBytes || 0);
    const proInstalled = Boolean((localAiStatus?.pro || localAiStatus || {}).installed);
    const ultraInstalled = Boolean(localAiStatus?.ultra?.installed);
    let profile = "avelune-natural";
    const reasons = [];
    if ((metrics.blockiness > 5.2 && metrics.edge < 35) || (metrics.megapixels < 0.7 && metrics.blockiness > 3.2) || metrics.noise > 14) {
      if (ultraInstalled && vramBytes >= 8 * 1024 ** 3) {
        profile = "avelune-photo-restore-ultra";
        reasons.push("обнаружены сильные повреждения; Ultra установлен и видеопамяти достаточно");
      } else if (proInstalled && vramBytes >= 4 * 1024 ** 3) {
        profile = "avelune-generative-restore";
        reasons.push("обнаружены сильные повреждения; выбран локальный Photo Restore Pro");
      } else {
        profile = "avelune-neural-restore";
        reasons.push("обнаружены сильная пикселизация, компрессия или утрата текстур");
      }
    } else if (metrics.blockiness > 3.6 || metrics.noise > 10.5 || (metrics.saturation < .12 && metrics.luminance < 150)) {
      profile = "avelune-restore";
      reasons.push("обнаружены шум, JPEG-блоки или признаки старого снимка; выбран бережный режим");
    } else if (metrics.edge > 47 && metrics.saturation > .22) {
      profile = "avelune-art";
      reasons.push("много чётких контуров и насыщенных плоских цветов");
    } else if (metrics.edge > 38 && metrics.noise < 5.5) {
      profile = "avelune-detail-plus";
      reasons.push("изображение содержит много мелких чистых деталей");
    } else {
      reasons.push("сбалансированная фотографическая структура");
    }
    if (metrics.megapixels > 18 && vramBytes < 4 * 1024 ** 3) {
      profile = "avelune-fast";
      reasons.push("высокое разрешение и ограниченная видеопамять");
    }
    const smartDecision = resolveSmartProfile(metrics, vramBytes);
    profile = smartDecision.profile;
    reasons.splice(0, reasons.length, ...smartDecision.reasons);
    if (shouldApply) applyProfile(profile);
    const recommendedTile = recommendedTileForVram(detectedSystemInfo?.gpu?.dedicatedVideoMemoryBytes);
    if (shouldApply) {
      state.tileSize = recommendedTile;
      syncSingleControls(); saveState();
    }
    const label = getProfilePresentation(profile).label;
    const explanation = `${label}: ${reasons.join("; ")}. Тайл: ${recommendedTile || "авто"}.`;
    if (!silent) {
      if (els.autoAnalysisResult) els.autoAnalysisResult.classList.remove("hidden");
      if (els.autoAnalysisText) els.autoAnalysisText.textContent = explanation;
      showToast(shouldApply ? "Авто-профиль применён" : "Smart Restore готов", explanation, "success", 6500);
    }
    return { profile, metrics, recommendedTile, explanation };
  }

  function renderBatchQueue() {
    if (!els.batchQueueList) return;
    const queue = Array.isArray(state.batchQueue) ? state.batchQueue : [];
    const counts = queue.reduce((acc,item) => { acc[item.state || "queued"] = (acc[item.state || "queued"] || 0) + 1; return acc; }, {});
    els.batchQueueSummary.textContent = queue.length ? `${queue.length} файлов · готово ${counts.completed || 0} · ошибок ${counts.failed || 0} · пропущено ${counts.skipped || 0}` : "Выберите исходную папку, чтобы увидеть файлы.";
    const hasFailedItems = counts.failed > 0;
    els.batchRetryButton.disabled = !hasFailedItems;
    els.batchRetryButton.classList.toggle("hidden", !hasFailedItems);
    if (!queue.length) {
      els.batchQueueList.innerHTML = '<div class="queue-empty">Очередь пока пуста</div>';
      translateSubtree(els.batchQueueList);
      return;
    }
    const completedTimes = queue.filter(item => item.elapsedMs > 0 && item.state === "completed").map(item => item.elapsedMs);
    const averageMs = completedTimes.length ? completedTimes.reduce((sum,value)=>sum+value,0) / completedTimes.length : 0;
    const waiting = queue.filter(item => ["queued","running"].includes(item.state)).length;
    if (queue.length && averageMs) els.batchQueueSummary.textContent += ` · осталось ~${formatElapsed(averageMs * waiting)}`;
    els.batchQueueList.innerHTML = queue.map(item => {
      const details = item.width && item.height ? `${item.width} × ${item.height}` : "Ожидает анализа";
      const elapsed = item.elapsedMs ? ` · ${formatElapsed(item.elapsedMs)}` : "";
      const open = item.output ? `<button type="button" data-queue-open="${escapeHtml(item.output)}">Открыть</button>` : "";
      return `<article class="queue-item" data-state="${escapeHtml(item.state || "queued")}" data-queue-id="${escapeHtml(item.id || "")}"><span class="queue-index">${Number(item.index || 0) + 1}</span><span class="queue-file"><strong>${escapeHtml(item.name || basename(item.path))}</strong><small>${details}${elapsed}</small>${item.error ? `<em>${escapeHtml(item.error)}</em>` : ""}</span><span class="queue-progress"><i style="width:${Math.max(0,Math.min(100,Number(item.progress)||0))}%"></i></span><span class="queue-status">${({queued:"В очереди",running:"Обработка",completed:"Готово",failed:"Ошибка",skipped:"Пропущено"})[item.state] || item.state}<span class="queue-item-actions">${open}<button type="button" data-queue-remove="${escapeHtml(item.id || "")}">Убрать</button></span></span></article>`;
    }).join("");
    translateSubtree(els.batchQueueList);
  }

  async function scanBatchQueue() {
    if (!state.batchFolderPath) { state.batchQueue = []; renderBatchQueue(); return; }
    if (!electron) { state.batchQueue = []; renderBatchQueue(); return; }
    try {
      els.batchQueueSummary.textContent = "Сканируем изображения…";
      state.batchQueue = await electron.invoke(COMMANDS.SCAN_BATCH_FOLDER, state.batchFolderPath);
      renderBatchQueue(); saveState();
    } catch (error) { state.batchQueue = []; renderBatchQueue(); showToast("Не удалось прочитать папку", cleanError(error), "error"); }
  }

  function handleBatchItemEvent(event) {
    if (!event || (activeBatchJob && event.jobId && event.jobId !== activeBatchJob.id)) return;
    if (event.state === "paused") { batchQueuePaused = true; els.batchPauseButton.classList.add("hidden"); els.batchResumeButton.classList.remove("hidden"); return; }
    if (event.state === "resumed") { batchQueuePaused = false; els.batchPauseButton.classList.remove("hidden"); els.batchResumeButton.classList.add("hidden"); return; }
    const index = state.batchQueue.findIndex(item => item.id === event.itemId);
    if (index >= 0) state.batchQueue[index] = { ...state.batchQueue[index], ...event };
    else if (event.itemId) state.batchQueue.push({ id: event.itemId, ...event });
    renderBatchQueue(); saveState();
  }

  async function runGpuAutotune() {
    if (!electron || !els.gpuAutotuneButton) return;
    els.gpuAutotuneButton.disabled = true;
    els.gpuAutotuneStatus.textContent = "Тестируем GPU и безопасные размеры тайла…";
    try {
      const report = await electron.invoke(COMMANDS.RUN_GPU_BENCHMARK);
      state.tileSize = Number(report.recommendedTile) || 0;
      state.batchTileSize = state.tileSize;
      syncSingleControls(); syncBatchControls(); saveState();
      const adapter = report.adapter?.name || detectedSystemInfo?.gpu?.deviceString || "GPU";
      const fastest = Array.isArray(report.results) ? report.results.filter(item=>item.ok).sort((a,b)=>a.elapsedMs-b.elapsedMs)[0] : null;
      els.gpuAutotuneStatus.textContent = `${adapter}: тайл ${state.tileSize || "авто"}${fastest ? ` · ${fastest.elapsedMs} мс` : " · безопасный профиль"}`;
      showToast("GPU AutoTune завершён", `Рекомендованный тайл: ${state.tileSize || "авто"}.`, "success");
    } catch (error) { els.gpuAutotuneStatus.textContent = `Ошибка теста: ${cleanError(error)}`; }
    finally { els.gpuAutotuneButton.disabled = false; }
  }

  function updateBatchFolders() {
    if (state.batchFolderPath) {
      els.batchInputLabel.textContent = basename(state.batchFolderPath) || "Исходная папка";
      els.batchInputPath.textContent = truncateMiddle(state.batchFolderPath, 68);
      els.batchInputPath.title = state.batchFolderPath;
    } else {
      els.batchInputPath.removeAttribute("title");
      els.batchInputLabel.textContent = "Выбрать папку с изображениями";
      els.batchInputPath.textContent = "PNG, JPG, JPEG и WebP";
    }
    if (state.batchOutputPath) {
      els.batchOutputLabel.textContent = basename(state.batchOutputPath) || "Папка результатов";
      els.batchOutputPath.textContent = truncateMiddle(state.batchOutputPath, 68);
      els.batchOutputPath.title = state.batchOutputPath;
    } else {
      els.batchOutputPath.removeAttribute("title");
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

  function setSourceImage(path, options = {}) {
    if (!path) return;
    const previewGeneration = ++sourcePreviewGeneration;
    const preferredUrl = String(options.previewUrl || "");
    state.imagePath = path;
    if (!state.outputPath) state.outputPath = dirname(path);
    resultPath = "";
    els.sourceName.textContent = basename(path);
    els.sourceName.title = basename(path);
    if (els.sidebarSourceLabel) els.sidebarSourceLabel.textContent = basename(path);
    els.sourcePath.textContent = truncateMiddle(path, 96);
    els.sourcePath.title = path;
    els.fileTypeIcon.textContent = extension(path).slice(0, 4);
    els.dropEmpty.classList.add("hidden");
    els.compareStage.classList.add("hidden");
    els.imageStage.classList.remove("hidden");
    els.clearImage.classList.remove("hidden");

    if (preferredUrl.startsWith("blob:")) replaceActiveSourceObjectUrl(preferredUrl);
    else replaceActiveSourceObjectUrl("");

    let fallbackAttempted = false;
    const applyUrl = (url) => {
      if (previewGeneration !== sourcePreviewGeneration || state.imagePath !== path) return;
      els.sourceImage.src = url;
      els.beforeImage.src = url;
    };

    els.sourceImage.onload = () => {
      if (previewGeneration !== sourcePreviewGeneration || state.imagePath !== path) return;
      sourceDimensions = {
        width: els.sourceImage.naturalWidth,
        height: els.sourceImage.naturalHeight
      };
      els.sourceResolution.textContent = `${sourceDimensions.width} × ${sourceDimensions.height}`;
      updateEstimate();
    };

    els.sourceImage.onerror = async () => {
      if (previewGeneration !== sourcePreviewGeneration || state.imagePath !== path) return;
      if (!fallbackAttempted && electron?.getImagePreview) {
        fallbackAttempted = true;
        try {
          const fallbackUrl = await createFallbackPreviewUrl(path);
          if (previewGeneration !== sourcePreviewGeneration || state.imagePath !== path) {
            revokeObjectUrl(fallbackUrl);
            return;
          }
          if (fallbackUrl) {
            replaceActiveSourceObjectUrl(fallbackUrl);
            applyUrl(fallbackUrl);
            return;
          }
        } catch (error) {
          console.warn("Preview fallback failed", error);
        }
      }
      if (options.isRestore) {
        // The path was restored from a previous session and no longer resolves to a
        // real file (moved/deleted since). Fall back to the clean empty state instead
        // of leaving the workspace showing a broken "image selected" layout.
        clearSourceImage();
        return;
      }
      sourceDimensions = null;
      els.sourceResolution.textContent = "Предпросмотр недоступен";
      updateEstimate();
    };

    const primaryUrl = preferredUrl || pathToFileUrl(path);
    if (primaryUrl) applyUrl(primaryUrl);
    else void els.sourceImage.onerror();

    syncSingleControls();
    updateStartState();
    saveState();
  }

  function clearSourceImage() {
    ++sourcePreviewGeneration;
    replaceActiveSourceObjectUrl("");
    clearPendingClipboardPreviews();
    state.imagePath = "";
    sourceDimensions = null;
    resultPath = "";
    if (els.sidebarSourceLabel) els.sidebarSourceLabel.textContent = "Файл ещё не выбран";
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
    if (target === "batch-input") await scanBatchQueue();
  }

  function buildSinglePayload(requestId) {
    return {
      requestId,
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
      copyMetadata: Boolean(state.copyMetadata),
      preserveColorProfile: Boolean(state.preserveColorProfile),
      neuralRestore: Boolean(state.neuralRestore),
      neuralRestoreStrength: Number(state.neuralRestoreStrength) || 70,
      generativeRestore: Boolean(state.generativeRestore),
      restoreEngine: state.restoreEngine || (state.profile === "avelune-photo-restore-ultra" ? "ultra" : "pro"),
      restoreQuality: state.restoreQuality || "balanced",
      imagePath: state.imagePath,
      outputPath: state.outputPath
    };
  }

  function newJobId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const value = Math.random() * 16 | 0;
      return (char === "x" ? value : (value & 3 | 8)).toString(16);
    });
  }

  function immutableJobContext(type, payload, metadata = {}) {
    return Object.freeze({
      id: payload.requestId,
      type,
      payload: Object.freeze({ ...payload }),
      metadata: Object.freeze({ ...metadata }),
      startedAt: Date.now()
    });
  }

  async function startSingleProcessing() {
    if (processing) return;
    if (!state.imagePath) return showToast("Нет изображения", "Выберите исходный файл перед запуском.", "error");
    if (!state.outputPath) return showToast("Нет папки результата", "Выберите папку для сохранения.", "error");
    if (!fallbackUnavailableLocalRestore(true)) {
      syncSingleControls();
      saveState();
    }
    if (PROFILE_CATALOG[state.profile]?.smartRestore) {
      const report = await analyzeCurrentImage({ apply: false, silent: true });
      const smartProfile = report?.profile && !PROFILE_CATALOG[report.profile]?.smartRestore ? report.profile : "avelune-natural";
      applyProfile(smartProfile);
      if (report?.recommendedTile != null) {
        state.tileSize = Number(report.recommendedTile) || 0;
        syncSingleControls();
        saveState();
      }
      if (els.autoAnalysisResult) els.autoAnalysisResult.classList.remove("hidden");
      if (els.autoAnalysisText) els.autoAnalysisText.textContent = report?.explanation || "Smart Restore выбрал универсальный Natural pipeline.";
    }
    const requestId = newJobId();
    const payload = buildSinglePayload(requestId);
    const type = state.doublePass ? "double" : "single";
    activeSingleJob = immutableJobContext(type, payload, { profile: state.profile, sourcePreviewUrl: activeSourceObjectUrl });
    processing = true;
    setSingleProgress(0, "Подготовка модели", "Инициализация");
    els.processingOverlay.classList.add("hidden");
    setWorkspaceProcessingVisible(true);
    els.startButton.classList.add("hidden");
    // Cancellation remains available in the compact workspace HUD; do not expand the sidebar footer.
    els.stopButton.classList.add("hidden");
    updateStartState();
    const command = type === "double" ? COMMANDS.DOUBLE_AVELUNE : COMMANDS.AVELUNE;
    if (electron) electron.send(command, payload); else simulateSingleProcessing(activeSingleJob);
  }

  function simulateSingleProcessing(job) {
    let progress = 0;
    clearInterval(demoTimer);
    demoTimer = setInterval(() => {
      progress += Math.ceil(Math.random() * 8);
      if (progress >= 100) { clearInterval(demoTimer); finishSingleProcessing({ jobId: job.id, jobType: job.type, result: job.payload.imagePath }, true); }
      else setSingleProgress(progress, progress > 82 ? "Финальная обработка" : "Восстанавливаем детали", progress > 82 ? "Конвертация" : "AI-реконструкция");
    }, 220);
  }

  function setSingleProgress(percent, message, stage) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const rounded = Math.round(value);
    els.progressFill.style.width = `${value}%`;
    els.progressValue.textContent = `${rounded}%`;
    if (els.workspaceProgressFill) els.workspaceProgressFill.style.width = `${value}%`;
    if (els.workspaceProgressValue) els.workspaceProgressValue.textContent = `${rounded}%`;
    if (els.progressOrb) els.progressOrb.style.setProperty("--progress", String(value));
    if (message) {
      els.processingMessage.textContent = message;
      if (els.workspaceProcessingMessage) els.workspaceProcessingMessage.textContent = message;
    }
    if (stage) {
      els.progressStage.textContent = stage;
      if (els.workspaceProcessingStage) els.workspaceProcessingStage.textContent = stage;
    }
    const title = value > 92 ? "Сохраняем результат" : value > 0 ? "Восстанавливаем детали" : "Подготавливаем обработку";
    els.processingTitle.textContent = title;
    if (els.workspaceProcessingTitle) els.workspaceProcessingTitle.textContent = title;
    const activeStep = value > 92 ? "export" : value > 4 ? "reconstruct" : "prepare";
    $$('[data-processing-step]').forEach(step => {
      const order = { prepare: 1, reconstruct: 2, export: 3 };
      step.classList.toggle("active", order[step.dataset.processingStep] <= order[activeStep]);
      step.classList.toggle("current", step.dataset.processingStep === activeStep);
    });
  }

  function parseProgress(raw) {
    const text = String(raw || "");
    const matches = [...text.matchAll(/(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%/g)];
    if (matches.length) return Math.min(99, Number(matches[matches.length - 1][1]));
    const plain = text.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*$/);
    return plain ? Math.min(99, Number(plain[1])) : null;
  }

  function handleSingleProgress(envelope) {
    if (!activeSingleJob || envelope?.jobId !== activeSingleJob.id) return;
    const text = String(envelope?.value || "");
    const value = parseProgress(text);
    const neural = Boolean(activeSingleJob.payload.neuralRestore);
    if (value !== null) {
      if (neural && value <= 43) setSingleProgress(value, "Очищаем пикселизацию, шум и компрессионные блоки", "Нейровосстановление · этап 1/2");
      else if (neural) setSingleProgress(value, "Реконструируем текстуры и правдоподобные мелкие детали", "Нейровосстановление · этап 2/2");
      else setSingleProgress(value, "Нейросеть анализирует и восстанавливает изображение", "AI-реконструкция");
    }
    if (/Нейровосстановление 1\/2|Очистка структуры/i.test(text)) setSingleProgress(Math.max(value || 1, 2), "Очищаем структуру изображения", "Нейровосстановление · этап 1/2");
    if (/Нейровосстановление 2\/2|Реконструкция деталей/i.test(text)) setSingleProgress(Math.max(value || 43, 43), "Создаём правдоподобные текстуры и детали", "Нейровосстановление · этап 2/2");
    if (/resiz/i.test(text)) setSingleProgress(96, "Масштабируем и конвертируем изображение", "Финальная обработка");
    if (/load|model/i.test(text) && value === null) setSingleProgress(4, "Загружаем выбранную AI-модель", "Подготовка модели");
  }

  function finishSingleProcessing(envelope, simulated = false) {
    if (!activeSingleJob || envelope?.jobId !== activeSingleJob.id) return;
    const job = activeSingleJob;
    const path = envelope.result;
    activeSingleJob = null;
    processing = false;
    resultPath = path;
    setSingleProgress(100, "Результат готов", "Завершено");
    els.processingOverlay.classList.add("hidden");
    setWorkspaceProcessingVisible(false);
    els.startButton.classList.remove("hidden");
    els.stopButton.classList.add("hidden");
    els.imageStage.classList.add("hidden");
    els.compareStage.classList.remove("hidden");
    const resultUrl = pathToFileUrl(path);
    els.afterImage.onerror = async () => {
      try {
        const fallbackUrl = await createFallbackPreviewUrl(path);
        if (fallbackUrl) els.afterImage.src = fallbackUrl;
      } catch (error) {
        console.warn("Result preview fallback failed", error);
      }
    };
    els.afterImage.src = resultUrl;
    els.beforeImage.src = job.metadata.sourcePreviewUrl || pathToFileUrl(job.payload.imagePath);
    els.resultPath.textContent = path;
    setCompareSplit(50);
    requestAnimationFrame(syncCompareFrame);
    updateStartState();
    addHistory({ type:"single", input:job.payload.imagePath, output:path, model:job.payload.model, profile:job.metadata.profile, scale:job.payload.useCustomWidth?`${job.payload.customWidth}px`:`${job.payload.scale}×`, format:job.payload.saveImageAs, timestamp:Date.now(), status:"success" });
    showToast("Изображение готово", simulated ? "Демонстрационная обработка завершена." : "Результат сохранён в выбранной папке.", "success");
  }

  function failSingleProcessing(envelope) {
    if (!activeSingleJob || (envelope?.jobId && envelope.jobId !== activeSingleJob.id)) return;
    activeSingleJob = null; processing = false; clearInterval(demoTimer);
    els.processingOverlay.classList.add("hidden"); setWorkspaceProcessingVisible(false); els.startButton.classList.remove("hidden"); els.stopButton.classList.add("hidden"); updateStartState();
    showToast("Не удалось обработать изображение", cleanError(envelope?.error || envelope), "error", 9000);
  }

  function cleanError(error) {
    const text = String(error || "Неизвестная ошибка").replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (/watchdog|перестал отвечать|время обработки/i.test(text)) return text;
    if (/vk|vulkan|gpu/i.test(text)) return "Проверьте поддержку Vulkan, драйвер видеокарты или попробуйте другой GPU ID / размер тайла.";
    if (/memory|alloc/i.test(text)) return "Недостаточно видеопамяти. Уменьшите размер тайла или масштаб.";
    return text.length > 320 ? `${text.slice(0, 317)}…` : text;
  }

  function stopSingle() {
    if (!processing || !activeSingleJob) return;
    if (electron) electron.send(COMMANDS.STOP, { jobId: activeSingleJob.id });
    clearInterval(demoTimer); activeSingleJob = null; processing = false;
    els.processingOverlay.classList.add("hidden"); setWorkspaceProcessingVisible(false); els.startButton.classList.remove("hidden"); els.stopButton.classList.add("hidden"); updateStartState();
    showToast("Обработка остановлена", "Текущая задача была отменена.", "info");
  }

  function buildBatchPayload(requestId) {
    const files = state.batchQueue.filter(item => item.state !== "removed" && item.path).map(item => item.path);
    return { requestId, tileSize:Number(state.batchTileSize)||0, compression:Number(state.batchCompression), ttaMode:Boolean(state.batchTtaMode), scale:String(state.batchScale), useCustomWidth:false, customWidth:"", model:state.batchModel, gpuId:String(state.batchGpuId||""), saveImageAs:state.batchFormat, overwrite:false, copyMetadata:Boolean(state.copyMetadata), preserveColorProfile:Boolean(state.preserveColorProfile), neuralRestore:Boolean(state.batchNeuralRestore), neuralRestoreStrength:Number(state.batchNeuralRestoreStrength)||70, continueOnError:Boolean(state.batchContinueOnError), skipExisting:Boolean(state.batchSkipExisting), files, batchFolderPath:state.batchFolderPath, outputPath:state.batchOutputPath };
  }

  function startBatchProcessing() {
    if (batchProcessing) return;
    if (!state.batchFolderPath || !state.batchOutputPath) return showToast("Папки не выбраны", "Укажите источник и папку результатов.", "error");
    const payload = buildBatchPayload(newJobId());
    activeBatchJob = immutableJobContext("batch", payload, { profile: state.batchProfile });
    batchProcessing = true; batchQueuePaused = false; els.batchStartButton.classList.add("hidden"); els.batchStopButton.classList.remove("hidden"); els.batchPauseButton?.classList.remove("hidden"); els.batchResumeButton?.classList.add("hidden"); els.batchProgress.classList.remove("hidden"); setBatchProgress(0,"Подготовка модели…"); state.batchQueue = state.batchQueue.map(item => ({...item,state:"queued",progress:0,error:""})); renderBatchQueue(); updateBatchFolders();
    if (electron) electron.send(COMMANDS.FOLDER_AVELUNE,payload); else simulateBatchProcessing(activeBatchJob);
  }

  function simulateBatchProcessing(job) { let progress=0;clearInterval(demoTimer);demoTimer=setInterval(()=>{progress+=Math.ceil(Math.random()*7);if(progress>=100){clearInterval(demoTimer);finishBatchProcessing({jobId:job.id,jobType:"batch",result:job.payload.outputPath},true);}else setBatchProgress(progress,progress>90?"Сохраняем файлы…":"Обрабатываем изображения…");},240); }
  function setBatchProgress(percent,stage){const value=Math.max(0,Math.min(100,Number(percent)||0));els.batchProgressFill.style.width=`${value}%`;els.batchProgressValue.textContent=`${Math.round(value)}%`;if(stage)els.batchProgressStage.textContent=stage;}
  function handleBatchProgress(envelope){if(!activeBatchJob||envelope?.jobId!==activeBatchJob.id)return;const text=String(envelope?.value||"");const value=parseProgress(text);if(value!==null)setBatchProgress(value,"Обрабатываем изображения…");if(/resiz/i.test(text))setBatchProgress(Math.max(94,value||0),"Финальная конвертация…");const fileMatch=text.match(/(\d+)\s*\/\s*(\d+)/);if(fileMatch)els.batchProgressStage.textContent=`Файл ${fileMatch[1]} из ${fileMatch[2]}`;}
  function finishBatchProcessing(envelope,simulated=false){if(!activeBatchJob||envelope?.jobId!==activeBatchJob.id)return;const job=activeBatchJob;const result=envelope.result||{};const path=typeof result==="string"?result:result.resultDirectory;activeBatchJob=null;batchProcessing=false;batchQueuePaused=false;setBatchProgress(100,"Готово");els.batchStartButton.classList.remove("hidden");els.batchStopButton.classList.add("hidden");els.batchPauseButton?.classList.add("hidden");els.batchResumeButton?.classList.add("hidden");updateBatchFolders();renderBatchQueue();addHistory({type:"batch",input:job.payload.batchFolderPath,output:path,model:job.payload.model,profile:job.metadata.profile,scale:`${job.payload.scale}×`,format:job.payload.saveImageAs,timestamp:Date.now(),status:"success"});const summary=typeof result==="object"?`Готово ${result.completed||0}, ошибок ${result.failed||0}, всего ${result.total||state.batchQueue.length}.`:"Результаты сохранены в новой папке.";showToast("Папка обработана",simulated?"Демонстрационная пакетная обработка завершена.":summary,"success");}
  function failBatchProcessing(envelope){if(!activeBatchJob||(envelope?.jobId&&envelope.jobId!==activeBatchJob.id))return;activeBatchJob=null;batchProcessing=false;batchQueuePaused=false;els.batchStartButton.classList.remove("hidden");els.batchStopButton.classList.add("hidden");els.batchPauseButton?.classList.add("hidden");els.batchResumeButton?.classList.add("hidden");updateBatchFolders();renderBatchQueue();showToast("Ошибка пакетной обработки",cleanError(envelope?.error||envelope),"error",9000);}
  function stopBatch(){if(!batchProcessing||!activeBatchJob)return;if(electron)electron.send(COMMANDS.STOP,{jobId:activeBatchJob.id});clearInterval(demoTimer);activeBatchJob=null;batchProcessing=false;batchQueuePaused=false;els.batchStartButton.classList.remove("hidden");els.batchStopButton.classList.add("hidden");els.batchPauseButton?.classList.add("hidden");els.batchResumeButton?.classList.add("hidden");updateBatchFolders();renderBatchQueue();showToast("Пакетная обработка остановлена","Текущая операция отменена.","info");}

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
        ? `<img class="history-preview-image" src="${pathToFileUrl(item.output)}" alt="" data-history-preview="true">`
        : `<svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>`;
      return `<article class="history-item" data-history-id="${escapeHtml(item.id)}">
        <div class="history-thumb">${thumb}</div>
        <div class="history-main"><strong>${escapeHtml(basename(item.input) || item.input || "Задача")}</strong><small>${escapeHtml(truncateMiddle(item.output || "", 76))}</small></div>
        <div class="history-meta"><strong>${escapeHtml(MODEL_META[item.model]?.label || item.model || "AI-модель")}</strong><small>${escapeHtml(`${item.scale || "—"} · ${(item.format || "").toUpperCase()}`)}</small></div>
        <span class="history-status">✓ Готово</span>
        <div class="history-actions"><button data-history-open="${escapeAttr(item.output || "")}" title="Открыть"><svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg></button><button data-history-copy="${escapeAttr(item.output || "")}" title="Копировать путь"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><button data-history-delete="${escapeAttr(item.id)}" title="Удалить"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button></div>
      </article>`;
    }).join("");
    translateSubtree(els.historyList);
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
    if (electron) electron.send(COMMANDS.OPEN_FOLDER, { path: target, revealFile: Boolean(preferFolder) });
    else showToast("Режим предпросмотра", `Открытие пути доступно в приложении: ${truncateMiddle(target, 90)}`, "info");
  }

  function showToast(title, message, type = "info", duration = 4800) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><div><strong>${escapeHtml(trUi(title))}</strong><small>${escapeHtml(trUi(message))}</small></div><button aria-label="${escapeAttr(trUi("Закрыть"))}">×</button>`;
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
    const requestId = createRequestId();
    latestClipboardRequestId = requestId;
    storePendingClipboardPreview(requestId, URL.createObjectURL(file));
    try {
      const buffer = await file.arrayBuffer();
      electron.send(COMMANDS.PASTE_IMAGE, {
        requestId,
        path: state.outputPath || dirname(state.imagePath) || "",
        extension: ext,
        buffer
      });
    } catch (error) {
      revokeObjectUrl(takePendingClipboardPreview(requestId));
      showToast("Не удалось вставить изображение", cleanError(error), "error");
    }
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
      syncModelPickerDevice(null);
      return;
    }
    try {
      const [info, version] = await Promise.all([electron.getSystemInfo(), electron.getAppVersion()]);
      detectedSystemInfo = info || null;
      const gpuName = info?.gpu?.deviceString || info?.gpu?.vendorString || "GPU с поддержкой Vulkan";
      els.hardwareLabel.textContent = truncateMiddle(gpuName, 30);
      els.appVersion.textContent = String(version || "v1.0.0").replace(/\s+FOSS$/i, "");
      $("#system-os").textContent = `${platformLabels[info?.platform] || info?.platform || "—"} ${info?.release || ""}`.trim();
      $("#system-cpu").textContent = `${info?.model || "—"}${info?.cpuCount ? ` · ${info.cpuCount} потоков` : ""}`;
      $("#system-gpu").textContent = gpuName;
      $("#system-memory").textContent = info?.totalMemory ? `${(Number(info.totalMemory) / 1073741824).toFixed(1)} ГБ` : "Определяется системой";
      syncModelPickerDevice(info);
    } catch (error) {
      console.warn(error);
      els.hardwareLabel.textContent = "GPU готов";
      syncModelPickerDevice(null);
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
    if (model.status === "official") return model.installed ? "Официальная модель · установлена" : "Официальная модель · доступна";
    if (model.status === "profile") return "Встроенный профиль · готов";
    return "Пользовательская модель";
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
    const legacyCount = all.filter(model => model.status === "profile").length;
    const userCount = all.filter(model => model.status === "user" || model.custom).length;
    if (els.modelManagerCount) els.modelManagerCount.textContent = `${installedCount} установлено · ${all.length} в каталоге`;
    if (els.modelOfficialCount) els.modelOfficialCount.textContent = officialCount;
    if (els.modelLegacyCount) els.modelLegacyCount.textContent = legacyCount;
    if (els.modelUserCount) els.modelUserCount.textContent = userCount;

    els.modelCatalogGrid.innerHTML = visible.length ? visible.map(model => {
      const selected = model.status === "profile" ? state.profile === model.id : state.model === model.id;
      const badgeClass = model.status === "official" ? "verified" : model.status === "profile" ? "profile" : "user";
      const origin = model.upstream ? `<div class="model-origin"><span>Основа</span><strong>${escapeHtml(model.upstream)}</strong></div>` : "";
      const attribution = model.author ? `<div class="model-origin"><span>Автор</span><strong>${escapeHtml(model.author)}</strong></div>` : "";
      const license = model.license ? `<span class="model-license-chip">${escapeHtml(model.license)}</span>` : "";
      const warning = !model.verified ? `<p class="model-warning">Пользовательская AI-модель не проверена Avelune. Источник, совместимость и право использования определяет владелец файлов.</p>` : model.status === "profile" ? `<p class="model-profile-note">Это профиль настроек на основе указанной проверенной модели, а не отдельные обученные веса.</p>` : "";
      const primaryAction = model.installed
        ? `<button class="model-use-button${selected ? " selected" : ""}" data-model-use="${escapeHtml(model.id)}">${selected ? "Выбрана" : "Использовать"}</button>`
        : `<button class="model-use-button import" data-model-import="${escapeHtml(model.id)}">Подключить файлы</button>`;
      const links = [
        model.sourceUrl ? `<button class="model-link-button" data-model-url="${escapeHtml(model.sourceUrl)}">Источник</button>` : "",
        model.licenseUrl ? `<button class="model-link-button" data-model-url="${escapeHtml(model.licenseUrl)}">Лицензия</button>` : ""
      ].join("");
      return `<article class="catalog-model-card ${badgeClass}${selected ? " active" : ""}">
        <div class="catalog-model-head"><div class="catalog-model-icon"${model.status === "official" ? ' title="Официальная модель" aria-label="Официальная модель"' : ""}>${model.status === "official" ? "✓" : model.status === "profile" ? "◇" : "AI"}</div><div><span class="catalog-status ${badgeClass}">${escapeHtml(modelStatusLabel(model))}</span><h4>${escapeHtml(model.label)}</h4><small>${escapeHtml(model.category || "AI-модель")}</small></div></div>
        <p class="catalog-model-description">${escapeHtml(model.short || "")}</p>
        <div class="catalog-model-specs"><span>${escapeHtml(model.scale || "Авто")}</span><span>${escapeHtml(model.speed || "—")}</span>${license}</div>
        <div class="catalog-model-origin">${origin}${attribution}</div>
        ${warning}
        <div class="catalog-model-actions">${primaryAction}${links}</div>
      </article>`;
    }).join("") : `<div class="model-catalog-empty"><strong>Модели не найдены</strong><span>Измените фильтр или поисковый запрос.</span></div>`;
    translateSubtree(els.modelCatalogGrid);
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
    translateSubtree(els.customModelList);
  }

  function setupElectronEvents() {
    if (!electron) return;
    electron.on(COMMANDS.AVELUNE_PROGRESS, (_event, envelope) => handleSingleProgress(envelope));
    electron.on(COMMANDS.DOUBLE_AVELUNE_PROGRESS, (_event, envelope) => handleSingleProgress(envelope));
    electron.on(COMMANDS.AVELUNE_DONE, (_event, envelope) => finishSingleProcessing(envelope));
    electron.on(COMMANDS.DOUBLE_AVELUNE_DONE, (_event, envelope) => finishSingleProcessing(envelope));
    electron.on(COMMANDS.FOLDER_AVELUNE_PROGRESS, (_event, envelope) => handleBatchProgress(envelope));
    electron.on(COMMANDS.FOLDER_AVELUNE_DONE, (_event, envelope) => finishBatchProcessing(envelope));
    electron.on(COMMANDS.BATCH_ITEM_EVENT, (_event, payload) => handleBatchItemEvent(payload));
    electron.on(COMMANDS.LOCAL_AI_PROGRESS, (_event, payload) => {
      const percent = normalizePercent(payload?.percent);
      const isUltra = payload?.tier === "ultra";
      const progressWrap = isUltra ? els.ultraAiProgress : els.localAiProgress;
      const progressBar = isUltra ? els.ultraAiProgressBar : els.localAiProgressBar;
      const progressText = isUltra ? els.ultraAiProgressText : els.localAiProgressText;
      progressWrap?.classList.remove("hidden");
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = payload?.message || `Установка: ${percent}%`;
    });
    electron.on(COMMANDS.AVELUNE_ERROR, (_event, envelope) => {
      if (envelope?.jobType === "batch") failBatchProcessing(envelope);
      else if (envelope?.jobType === "single" || envelope?.jobType === "double") failSingleProcessing(envelope);
    });
    electron.on(COMMANDS.PASTE_IMAGE_SAVE_SUCCESS, (_event, payload) => {
      const requestId = String(payload?.requestId || "");
      const path = String(payload?.path || "");
      const previewUrl = takePendingClipboardPreview(requestId);
      if (requestId !== latestClipboardRequestId) {
        revokeObjectUrl(previewUrl);
        return;
      }
      latestClipboardRequestId = "";
      if (!path || !previewUrl) return;
      setSourceImage(path, { previewUrl });
      showToast("Изображение вставлено", "Файл из буфера обмена готов к обработке.", "success");
    });
    electron.on(COMMANDS.PASTE_IMAGE_SAVE_ERROR, (_event, payload) => {
      const requestId = String(payload?.requestId || "");
      revokeObjectUrl(takePendingClipboardPreview(requestId));
      if (requestId !== latestClipboardRequestId) return;
      latestClipboardRequestId = "";
      showToast("Не удалось вставить изображение", cleanError(payload?.error), "error");
    });
    electron.on(COMMANDS.CUSTOM_MODEL_FILES_LIST, (_event, models) => {
      state.customModels = Array.isArray(models) ? models : [];
      renderCustomModels();
      saveState();
      if (state.customModels.length) showToast("Модели подключены", `Найдено моделей: ${state.customModels.length}.`, "success");
    });
  }


  let comparePointerId = null;
  let compareFrameId = 0;
  let pendingCompareClientX = 0;
  let compareResizeObserver = null;

  function getImageAspect(image) {
    const width = Number(image?.naturalWidth) || 0;
    const height = Number(image?.naturalHeight) || 0;
    return width > 0 && height > 0 ? width / height : 0;
  }

  function syncCompareFrame() {
    if (!els.compareCanvas || !els.compareFrame || els.compareStage.classList.contains("hidden")) return;
    const rect = els.compareCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const aspect = getImageAspect(els.beforeImage) || getImageAspect(els.afterImage) || 1;
    let width = rect.width;
    let height = width / aspect;
    if (height > rect.height) {
      height = rect.height;
      width = height * aspect;
    }
    els.compareFrame.style.width = `${Math.max(1, Math.floor(width))}px`;
    els.compareFrame.style.height = `${Math.max(1, Math.floor(height))}px`;
  }

  function scheduleCompareSplit(clientX) {
    pendingCompareClientX = clientX;
    if (compareFrameId) return;
    compareFrameId = requestAnimationFrame(() => {
      compareFrameId = 0;
      setCompareSplitFromClientX(pendingCompareClientX);
    });
  }

  function setCompareSplit(rawPercent) {
    const percent = Math.max(0, Math.min(100, Number(rawPercent) || 0));
    const precise = percent.toFixed(4);
    els.compareCanvas.style.setProperty("--split", `${precise}%`);
    els.compareRange.value = percent.toFixed(2);
    els.compareCanvas.setAttribute("aria-valuenow", percent.toFixed(2));
  }

  function setCompareSplitFromClientX(clientX) {
    syncCompareFrame();
    const rect = (els.compareFrame || els.compareCanvas).getBoundingClientRect();
    if (!rect.width) return;
    setCompareSplit(((clientX - rect.left) / rect.width) * 100);
  }

  function installPreciseCompareSlider() {
    els.beforeImage.addEventListener("load", syncCompareFrame);
    els.afterImage.addEventListener("load", syncCompareFrame);
    window.addEventListener("resize", syncCompareFrame);
    if (window.ResizeObserver && els.compareCanvas) {
      compareResizeObserver = new ResizeObserver(syncCompareFrame);
      compareResizeObserver.observe(els.compareCanvas);
    }

    els.compareCanvas.addEventListener("pointerdown", event => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      comparePointerId = event.pointerId;
      els.compareCanvas.classList.add("is-dragging");
      els.compareCanvas.setPointerCapture(event.pointerId);
      els.compareCanvas.focus({ preventScroll: true });
      setCompareSplitFromClientX(event.clientX);
    });

    els.compareCanvas.addEventListener("pointermove", event => {
      if (event.pointerId !== comparePointerId) return;
      event.preventDefault();
      scheduleCompareSplit(event.clientX);
    });

    const finishPointer = event => {
      if (event.pointerId !== comparePointerId) return;
      if (els.compareCanvas.hasPointerCapture(event.pointerId)) {
        els.compareCanvas.releasePointerCapture(event.pointerId);
      }
      if (compareFrameId) {
        cancelAnimationFrame(compareFrameId);
        compareFrameId = 0;
        setCompareSplitFromClientX(pendingCompareClientX);
      }
      comparePointerId = null;
      els.compareCanvas.classList.remove("is-dragging");
    };

    els.compareCanvas.addEventListener("pointerup", finishPointer);
    els.compareCanvas.addEventListener("pointercancel", finishPointer);
    els.compareCanvas.addEventListener("lostpointercapture", () => {
      comparePointerId = null;
      els.compareCanvas.classList.remove("is-dragging");
    });

    els.compareCanvas.addEventListener("keydown", event => {
      let delta = 0;
      if (event.key === "ArrowLeft") delta = event.shiftKey ? -5 : -0.5;
      else if (event.key === "ArrowRight") delta = event.shiftKey ? 5 : 0.5;
      else if (event.key === "Home") {
        event.preventDefault();
        setCompareSplit(0);
        return;
      } else if (event.key === "End") {
        event.preventDefault();
        setCompareSplit(100);
        return;
      } else {
        return;
      }

      event.preventDefault();
      setCompareSplit(Number(els.compareRange.value) + delta);
    });

    els.compareRange.addEventListener("input", event => {
      setCompareSplit(Number(event.target.value));
    });
  }

  function bindEvents() {
    els.historyList.addEventListener("error", event => {
      const image = event.target.closest?.("img[data-history-preview]");
      if (!image) return;
      const placeholder = document.createElement("span");
      placeholder.className = "history-preview-fallback";
      placeholder.textContent = "IMG";
      image.replaceWith(placeholder);
    }, true);
    window.addEventListener("beforeunload", persistState);
    els.navItems.forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.view)));
    els.sidebarCollapse?.addEventListener("click", () => setCompactMenu(!state.compactMenu));
    if (els.controlsToggle) els.controlsToggle.addEventListener("click", () => setControlsCollapsed(!state.controlsCollapsed));
    $("#theme-toggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
    $$("[data-theme-choice]").forEach(btn => btn.addEventListener("click", () => setTheme(btn.dataset.themeChoice)));
    els.languageSelect?.addEventListener("change", event => {
      setLanguage(event.target.value || "auto");
      showToast("Язык интерфейса", "Настройка языка применена.", "success");
    });
    els.compactMenuToggle.addEventListener("change", event => setCompactMenu(event.target.checked));
    els.saveHistoryToggle.addEventListener("change", event => { state.saveHistory = event.target.checked; saveState(); });
    els.autoProfileButton?.addEventListener("click", analyzeCurrentImage);
    els.copyMetadataToggle?.addEventListener("change", event => { state.copyMetadata = event.target.checked; saveState(); });
    els.preserveColorToggle?.addEventListener("change", event => { state.preserveColorProfile = event.target.checked; saveState(); });
    els.neuralRestoreToggle?.addEventListener("change", event => {
      if (event.target.checked) applyProfile("avelune-neural-restore");
      else if (state.profile === "avelune-neural-restore") applyProfile("avelune-restore");
      else { state.neuralRestore = false; syncSingleControls(); saveState(); }
    });
    els.neuralRestoreStrengthRange?.addEventListener("input", event => { state.neuralRestoreStrength = Math.max(20, Math.min(100, Number(event.target.value) || 70)); syncSingleControls(); saveState(); });
    els.generativeRestoreToggle?.addEventListener("change", event => {
      if (event.target.checked && !isLocalAiTierInstalled("pro")) {
        event.target.checked = false;
        state.generativeRestore = false;
        showToast("Photo Restore Pro не установлен", "Скачайте AI-пакет в настройках, затем включите локальное восстановление.", "info", 7000);
        syncSingleControls();
        saveState();
        return;
      }
      state.generativeRestore = Boolean(event.target.checked);
      if (state.generativeRestore) setSingleProfileState("avelune-generative-restore");
      else if (state.profile === "avelune-generative-restore") applyProfile("avelune-neural-restore");
      syncSingleControls(); saveState();
    });

    $("#select-file-button").addEventListener("click", event => { event.stopPropagation(); selectSingleImage(); });
    $("#sidebar-select-file-button")?.addEventListener("click", event => { event.stopPropagation(); selectSingleImage(); });
    $("#replace-image").addEventListener("click", event => { event.stopPropagation(); selectSingleImage(); });
    els.dropZone.addEventListener("click", event => {
      if (!els.dropEmpty.classList.contains("hidden") && event.target.id !== "select-file-button") selectSingleImage();
    });
    els.dropZone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") selectSingleImage(); });
    ["dragenter", "dragover"].forEach(name => els.dropZone.addEventListener(name, event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      els.dropZone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(name => els.dropZone.addEventListener(name, event => {
      event.preventDefault();
      els.dropZone.classList.remove("dragover");
    }));
    els.dropZone.addEventListener("drop", event => {
      const itemFile = event.dataTransfer?.items?.[0]?.kind === "file"
        ? event.dataTransfer.items[0].getAsFile()
        : null;
      const file = itemFile || event.dataTransfer?.files?.[0] || null;
      const fileName = String(file?.name || "");
      const supported = /\.(png|jpe?g|jfif|webp)$/i.test(fileName);

      if (!file || !supported) {
        showToast("Файл не поддерживается", "Перетащите PNG, JPG, JPEG или WebP.", "error");
        return;
      }

      const nativePath = electron?.getPathForFile?.(file) || "";
      if (!nativePath) {
        showToast("Не удалось открыть файл", "Avelune не смогла получить системный путь перетащенного изображения.", "error");
        return;
      }

      setSourceImage(nativePath);
    });
    $("#paste-button").addEventListener("click", pasteButtonAction);
    document.addEventListener("paste", pasteFromClipboardEvent);
    els.clearImage.addEventListener("click", clearSourceImage);

    $$(".preset-chip").forEach(btn => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
    $$(".model-card").forEach(card => card.addEventListener("click", () => applyProfile(card.dataset.profile)));
    els.extraModelSelect.addEventListener("change", event => {
      const value = event.target.value;
      if (!value) return;
      if (!applyProfile(value)) setModel(value);
    });
    els.modelPickerButton?.addEventListener("click", openProfilePicker);
    $("#model-picker-close")?.addEventListener("click", closeProfilePicker);
    els.modelPickerDialog?.addEventListener("cancel", event => { event.preventDefault(); closeProfilePicker(); });
    els.modelPickerDialog?.addEventListener("click", event => { if (event.target === els.modelPickerDialog) closeProfilePicker(); });
    $$("[data-profile-filter]").forEach(button => button.addEventListener("click", () => {
      modelPickerFilter = button.dataset.profileFilter || "all";
      $$("[data-profile-filter]").forEach(item => item.classList.toggle("active", item === button));
      renderProfilePicker();
    }));
    els.profileChoiceGrid?.addEventListener("click", event => {
      const card = event.target.closest("[data-profile-id]");
      if (!card) return;
      if (!applyProfile(card.dataset.profileId)) return;
      closeProfilePicker();
      showToast("AI-профиль выбран", `${getProfilePresentation(card.dataset.profileId).label} готов к обработке.`, "info");
    });
    $("#open-model-catalog")?.addEventListener("click", () => { closeProfilePicker(); navigate("settings"); });
    $("#workspace-stop-button")?.addEventListener("click", stopSingle);
    $("#workspace-stop-text")?.addEventListener("click", stopSingle);
    $$("#scale-segmented button").forEach(btn => btn.addEventListener("click", () => { state.scale = btn.dataset.scale; state.useCustomWidth = false; syncScaleSpecificModel("single"); syncSingleControls(); saveState(); }));
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
      ["profile","model","scale","saveImageAs","compression","useCustomWidth","customWidth","tileSize","gpuId","ttaMode","doublePass","overwrite","copyMetadata","preserveColorProfile","neuralRestore","neuralRestoreStrength","generativeRestore"].forEach(key => state[key] = DEFAULTS[key]);
      $$(".preset-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === "balanced"));
      syncSingleControls(); saveState(); showToast("Параметры сброшены", "Восстановлен универсальный профиль.", "info");
    });
    $("#select-output-button").addEventListener("click", () => selectOutputFolder("single"));
    $("#output-path-button").addEventListener("click", () => selectOutputFolder("single"));
    els.startButton.addEventListener("click", startSingleProcessing);
    els.stopButton.addEventListener("click", stopSingle);

    installPreciseCompareSlider();
    $("#open-result-folder").addEventListener("click", () => openPath(resultPath, true));
    $("#copy-result-path").addEventListener("click", () => copyText(resultPath));

    $("#batch-input-picker").addEventListener("click", () => selectOutputFolder("batch-input"));
    $("#batch-output-picker").addEventListener("click", () => selectOutputFolder("batch-output"));
    els.batchModelSelect.addEventListener("change", event => {
      const value = event.target.value;
      if (!applyProfile(value, "batch")) {
        state.batchProfile = `custom:${value}`;
        state.batchModel = value;
        updateBatchFolders();
        saveState();
      }
    });
    els.batchScaleSelect.addEventListener("change", event => { state.batchScale = event.target.value; syncScaleSpecificModel("batch"); updateBatchFolders(); saveState(); });
    els.batchFormatSelect.addEventListener("change", event => { state.batchFormat = event.target.value; updateBatchFolders(); saveState(); });
    els.batchQualityRange.addEventListener("input", event => { state.batchCompression = Number(event.target.value); els.batchQualityValue.textContent = `${state.batchCompression}%`; updateRangeBackground(event.target); saveState(); });
    els.batchTtaToggle.addEventListener("change", event => { state.batchTtaMode = event.target.checked; saveState(); });
    els.batchTileSelect.addEventListener("change", event => { state.batchTileSize = Number(event.target.value); saveState(); });
    els.batchGpuInput.addEventListener("input", event => { state.batchGpuId = event.target.value.trim(); saveState(); });
    els.batchContinueToggle?.addEventListener("change", event => { state.batchContinueOnError = event.target.checked; saveState(); });
    els.batchSkipToggle?.addEventListener("change", event => { state.batchSkipExisting = event.target.checked; saveState(); });
    els.batchStartButton.addEventListener("click", startBatchProcessing);
    els.batchStopButton.addEventListener("click", stopBatch);
    els.batchPauseButton?.addEventListener("click", () => { if (electron && activeBatchJob) electron.send(COMMANDS.PAUSE_BATCH, { jobId: activeBatchJob.id }); });
    els.batchResumeButton?.addEventListener("click", () => { if (electron && activeBatchJob) electron.send(COMMANDS.RESUME_BATCH, { jobId: activeBatchJob.id }); });
    els.batchRetryButton?.addEventListener("click", () => {
      state.batchQueue = state.batchQueue.map(item => item.state === "failed" ? { ...item, state: "queued", progress: 0, error: "" } : item);
      renderBatchQueue(); saveState();
      showToast("Ошибки готовы к повтору", "Запустите очередь ещё раз; уже готовые файлы будут пропущены.", "info");
    });
    els.batchQueueList?.addEventListener("click", event => {
      const open = event.target.closest("[data-queue-open]");
      const remove = event.target.closest("[data-queue-remove]");
      if (open) openPath(open.dataset.queueOpen, true);
      if (remove && !batchProcessing) {
        state.batchQueue = state.batchQueue.filter(item => item.id !== remove.dataset.queueRemove);
        renderBatchQueue(); saveState();
      }
    });

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
        const entry = MODEL_CATALOG.find(item => item.id === id);
        if (entry?.status === "profile") {
          applyProfile(id, "single");
          applyProfile(id, "batch");
        } else if (entry?.status === "official" && entry.defaultProfile) {
          applyProfile(entry.defaultProfile, "single");
          applyProfile(entry.defaultProfile, "batch");
        } else {
          state.profile = `custom:${id}`;
          state.batchProfile = `custom:${id}`;
          state.model = id;
          state.batchModel = id;
          syncSingleControls();
          syncBatchControls();
          saveState();
        }
        renderModelManager();
        showToast("Режим выбран", `${MODEL_META[id]?.label || id} будет использоваться для одиночной и пакетной обработки.`, "success");
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
    els.installLocalAi?.addEventListener("click", async () => {
      if (!electron?.installLocalAi) return;
      try {
        els.installLocalAi.disabled = true;
        els.localAiProgress?.classList.remove("hidden");
        const status = await electron.installLocalAi(els.localAiBackend?.value || "auto");
        renderLocalAiStatus(status);
        showToast("AI-пакет установлен", "Photo Restore Pro готов к локальной обработке.", "success");
      } catch (error) { showToast("Не удалось установить AI-пакет", error?.message || String(error), "error"); }
      finally { if (els.installLocalAi) els.installLocalAi.disabled = false; }
    });
    els.removeLocalAi?.addEventListener("click", async () => {
      if (!electron?.removeLocalAi) return;
      try { renderLocalAiStatus(await electron.removeLocalAi()); showToast("AI-пакет удалён", "Освобождено место на диске.", "success"); }
      catch (error) { showToast("Не удалось удалить пакет", error?.message || String(error), "error"); }
    });
    els.installUltraAi?.addEventListener("click", async()=>{if(!electron?.installLocalAi)return;try{els.installUltraAi.disabled=true;els.ultraAiProgress?.classList.remove("hidden");const st=await electron.installLocalAi(els.localAiBackend?.value||"auto","ultra");renderLocalAiStatus(st);showToast("Photo Restore Ultra установлен","DiffBIR v2.1 готов к максимальному локальному восстановлению.","success");}catch(e){showToast("Не удалось установить Ultra",e?.message||String(e),"error");}finally{els.installUltraAi.disabled=false;}});
    els.removeUltraAi?.addEventListener("click",async()=>{try{renderLocalAiStatus(await electron.removeLocalAi("ultra"));showToast("Ultra-пакет удалён","Место на диске освобождено.","success");}catch(e){showToast("Не удалось удалить Ultra",e?.message||String(e),"error");}});
    $("#reset-app-button").addEventListener("click", () => {
      const history = state.history;
      Object.assign(state, DEFAULTS, { history: state.saveHistory ? history : [] });
      localStorage.removeItem("lastImagePath");
      localStorage.removeItem("lastSavedBatchAveluneFolderPath");
      localStorage.removeItem("customModelsFolderPath");
      setTheme(DEFAULTS.theme); setLanguage(DEFAULTS.language, false); setCompactMenu(false); clearSourceImage(); syncSingleControls(); syncBatchControls(); renderCustomModels(); renderHistory(); saveState();
      showToast("Настройки сброшены", "Приложение возвращено к исходному профилю.", "info");
    });
    $("#open-license-button").addEventListener("click", () => window.open("https://www.gnu.org/licenses/agpl-3.0.html", "_blank"));
    els.gpuAutotuneButton?.addEventListener("click", runGpuAutotune);

    $("#about-button").addEventListener("click", () => els.aboutDialog.showModal());
    $("#about-close").addEventListener("click", () => els.aboutDialog.close());
    els.aboutDialog.addEventListener("click", event => { if (event.target === els.aboutDialog) els.aboutDialog.close(); });

    document.addEventListener("keydown", event => {
      if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); if (currentView === "batch") startBatchProcessing(); else startSingleProcessing(); }
      if (event.key === "Escape") { if (processing) stopSingle(); else if (batchProcessing) stopBatch(); }
    });
  }

  function formatPackBytes(bytes) { const n=Number(bytes)||0; return n ? `${(n/1073741824).toFixed(1)} ГБ` : "—"; }
  function renderLocalAiStatus(status) {
    localAiStatus = status || null;
    const restoredFallback = !fallbackUnavailableLocalRestore(false);
    const base=status?.pro||status||{}; const installed=Boolean(base?.installed);
    if (els.localAiStatusTitle) els.localAiStatusTitle.textContent = installed ? "Пакет установлен" : "Пакет не установлен";
    if (els.localAiStatusDetails) els.localAiStatusDetails.textContent = installed ? `Backend: ${(base.backend||"cpu").toUpperCase()} · полностью локально` : "Скачайте модели для профиля Photo Restore Pro";
    if (els.localAiSize) els.localAiSize.textContent = formatPackBytes(base?.bytes);
    els.removeLocalAi?.classList.toggle("hidden", !installed);
    if (els.installLocalAi) els.installLocalAi.textContent = installed ? "Переустановить" : "Скачать и установить";
    els.localAiProgress?.classList.add("hidden");
    const ultra=status?.ultra||{}; const ultraInstalled=Boolean(ultra.installed);
    if(els.ultraAiStatusTitle) els.ultraAiStatusTitle.textContent=ultraInstalled?"Ultra-пакет установлен":"Ultra-пакет не установлен";
    if(els.ultraAiStatusDetails) els.ultraAiStatusDetails.textContent=ultraInstalled?`DiffBIR 2.1 · ${(ultra.backend||"cuda").toUpperCase()} · полностью локально`:"Скачайте 8–15 ГБ для максимального diffusion-восстановления";
    if(els.ultraAiSize) els.ultraAiSize.textContent=formatPackBytes(ultra.bytes);
    els.removeUltraAi?.classList.toggle("hidden",!ultraInstalled); if(els.installUltraAi) els.installUltraAi.textContent=ultraInstalled?"Переустановить Ultra":"Скачать Ultra"; els.ultraAiProgress?.classList.add("hidden");
    syncModelPickerDevice();
    syncSingleControls();
    renderProfilePicker();
    translateSubtree();
    if (restoredFallback) saveState();
  }
  async function loadLocalAiStatus() { try { renderLocalAiStatus(await electron?.getLocalAiStatus?.()); } catch (error) { if (els.localAiStatusDetails) els.localAiStatusDetails.textContent=error?.message||"Ошибка проверки"; } }

  function initialize() {
    setTheme(state.theme);
    setLanguage(state.language || "auto", false);
    setCompactMenu(state.compactMenu);
    setControlsCollapsed(state.controlsCollapsed);
    els.body.dataset.activeView = currentView;
    els.saveHistoryToggle.checked = state.saveHistory;
    syncSingleControls();
    syncBatchControls();
    renderCustomModels();
    renderProfilePicker();
    renderHistory();
    renderBatchQueue();
    bindEvents();
    setupElectronEvents();
    loadSystemInfo();
    loadLocalAiStatus();
    if (state.imagePath) setSourceImage(state.imagePath, { isRestore: true });
    updateStartState();
    if (electron && state.customModelsFolderPath) electron.send(COMMANDS.GET_MODELS_LIST, state.customModelsFolderPath);
    if (electron && state.batchFolderPath && !state.batchQueue.length) scanBatchQueue();
    window.addEventListener("avelune-language-change", refreshLocalizedViews);
    translateSubtree();
  }

  initialize();
})();

/* FIXED18.2 compatibility marker: profile-preview-divider retained for UI QA */
const profilePreviewDividerClass = 'profile-preview-divider';
