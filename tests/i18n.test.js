"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const html = read("renderer/out/index.html");
const css = read("renderer/out/assets/app.css");
const renderer = read("renderer/out/assets/app.js");
const i18n = read("renderer/out/assets/i18n.js");

const expectedLocaleCodes = [
  "auto", "ru", "kk", "en", "es", "de", "fr", "pt-BR", "it", "pl", "uk",
  "be", "bg", "cs", "sk", "hu", "ro", "nl", "sv", "da", "fi", "nb", "el",
  "tr", "az", "uz", "ky", "ka", "hy", "zh-CN", "zh-TW", "ja", "ko", "ar",
  "he", "fa", "ur", "hi", "bn", "ta", "te", "mr", "th", "id", "ms", "fil",
  "sw", "vi"
];

function createI18nSandbox(language = "en-US") {
  const sandbox = {
    window: {},
    document: { body: null, documentElement: { lang: "ru", dataset: {}, dir: "ltr" } },
    navigator: { languages: [language], language },
    MutationObserver: function MutationObserver() {},
    CustomEvent: function CustomEvent() {},
    requestAnimationFrame: callback => callback(),
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
  };
  sandbox.window.dispatchEvent = () => {};
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(i18n, sandbox);
  return sandbox;
}

function htmlRussianSources() {
  const textNodes = [...html.matchAll(/>([^<>]*[\u0400-\u04FF][^<>]*)</g)]
    .map(match => match[1].trim())
    .filter(Boolean);
  const attributes = [...html.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*[\u0400-\u04FF][^"]*)"/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
  return [...new Set([...textNodes, ...attributes])];
}

function rendererRussianStringCandidates() {
  const values = [];
  for (let index = 0; index < renderer.length; index += 1) {
    const quote = renderer[index];
    if (!["\"", "'", "`"].includes(quote)) continue;
    let value = "";
    index += 1;
    for (; index < renderer.length; index += 1) {
      const char = renderer[index];
      if (char === "\\") {
        value += renderer[index + 1] || "";
        index += 1;
        continue;
      }
      if (quote === "`" && char === "$" && renderer[index + 1] === "{") {
        value += "${}";
        index += 2;
        let depth = 1;
        for (; index < renderer.length && depth > 0; index += 1) {
          const nested = renderer[index];
          if (nested === "\\") index += 1;
          else if (nested === "{") depth += 1;
          else if (nested === "}") depth -= 1;
        }
        index -= 1;
        continue;
      }
      if (char === quote) break;
      value += char;
    }
    if (/[\u0400-\u04FF]/.test(value)) values.push(value.replace(/\s+/g, " ").trim());
  }
  const invalidCandidate = /[,;{}<>]|\$\{|\$\}/;
  return [...new Set(values)].filter(value => value && value.length < 180 && !invalidCandidate.test(value));
}

test("multilingual UI script loads before the renderer application", () => {
  const i18nIndex = html.indexOf('src="assets/i18n.js"');
  const appIndex = html.indexOf('src="assets/app.js"');
  assert.ok(i18nIndex > 0, "i18n script is included");
  assert.ok(appIndex > i18nIndex, "i18n script loads before app.js");
});

test("settings expose automatic language detection and popular locales", () => {
  assert.match(html, /id="language-select"/);
  assert.match(html, /Язык интерфейса/);
  assert.match(html, /Автоматически по системе или вручную/);

  for (const code of expectedLocaleCodes) {
    assert.match(html, new RegExp(`value="${code.replace("-", "\\-")}"`));
    assert.match(i18n, new RegExp(`\\["${code.replace("-", "\\-")}"`));
  }
  assert.ok(expectedLocaleCodes.length >= 45);
  assert.match(html, /Қазақша/);
  assert.match(i18n, /Қазақша/);

  assert.match(css, /#language-select/);
  assert.match(css, /\.language-select/);
  assert.match(css, /\.language-setting-row/);
});

test("renderer persists language preference while preserving architecture", () => {
  assert.match(renderer, /language:\s*"auto"/);
  assert.match(renderer, /languageSelect:\s*\$\("#language-select"\)/);
  assert.match(renderer, /function setLanguage\(language = "auto", persist = true\)/);
  assert.match(renderer, /window\.aveluneI18n/);
  assert.match(renderer, /setLanguage\(state\.language \|\| "auto", false\)/);
  assert.match(renderer, /setLanguage\(event\.target\.value \|\| "auto"\)/);
  assert.match(renderer, /setLanguage\(DEFAULTS\.language, false\)/);
});

test("i18n engine detects system language and retranslates dynamic UI safely", () => {
  assert.match(i18n, /navigator\.languages/);
  assert.match(i18n, /navigator\.language/);
  assert.match(i18n, /MutationObserver/);
  assert.match(i18n, /document\.documentElement\.lang = activeLocale/);
  assert.match(i18n, /document\.documentElement\.dir = RTL_LOCALES\.has\(activeLocale\) \? "rtl" : "ltr"/);
  assert.match(i18n, /if \(SUPPORTED_SET\.has\(base\)\) return base;\s*return "auto";/);
  assert.match(i18n, /return FALLBACK_LOCALE/);
  assert.match(i18n, /function isKnownTranslation\(source, value\)/);
  assert.match(i18n, /Object\.keys\(TRANSLATIONS\)\.some/);
  assert.match(i18n, /window\.aveluneI18n = Object\.freeze/);
});

test("english locale covers settings package and hardware runtime strings", () => {
  for (const source of [
    "Пакет не установлен",
    "Ultra-пакет не установлен",
    "Скачайте модели для профиля Photo Restore Pro",
    "Скачайте 8–15 ГБ для максимального diffusion-восстановления",
    "Avelune Enhance — самостоятельная локальная среда для увеличения, восстановления и улучшения изображений. Все профили обрабатывают изображения локально. Тяжёлый Photo Restore Pro устанавливается отдельно через менеджер моделей.",
    "Тестируем GPU и безопасные размеры тайла…",
    "Определяется системой"
  ]) {
    assert.match(i18n, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(i18n, /DYNAMIC_PATTERNS/);
  assert.match(i18n, /Backend: \$\{match\[1\]\} · fully local/);
  assert.match(i18n, /logical threads/);
  assert.match(i18n, /Recommended tile:/);
});

test("english locale translates package status and dynamic hardware strings", () => {
  const sandbox = {
    window: {},
    document: { body: null, documentElement: { lang: "ru", dataset: {} } },
    navigator: { languages: ["en-US"], language: "en-US" },
    MutationObserver: function MutationObserver() {},
    CustomEvent: function CustomEvent() {},
    requestAnimationFrame: callback => callback(),
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
  };
  sandbox.window.dispatchEvent = () => {};
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(i18n, sandbox);

  const translate = sandbox.window.aveluneI18n.translate;
  assert.equal(translate("Пакет не установлен", "en"), "Package not installed");
  assert.equal(translate("Ultra-пакет не установлен", "en"), "Ultra package not installed");
  assert.equal(translate("Скачайте модели для профиля Photo Restore Pro", "en"), "Download models for the Photo Restore Pro profile");
  assert.equal(translate("Backend: CUDA · полностью локально", "en"), "Backend: CUDA · fully local");
  assert.equal(translate("31.9 ГБ", "en"), "31.9 GB");
  assert.equal(translate("8 логических потоков", "en"), "8 logical threads");
  assert.equal(translate("RTX 3060 Ti: тайл 256 · безопасный профиль", "en"), "RTX 3060 Ti: tile 256 · safe profile");
});

test("english locale covers every static renderer string and common dynamic renderer string", () => {
  const sandbox = createI18nSandbox("en-US");
  const translate = sandbox.window.aveluneI18n.translate;
  const missingHtml = htmlRussianSources().filter(source => translate(source, "en") === source);
  const missingRenderer = rendererRussianStringCandidates().filter(source => translate(source, "en") === source);

  assert.deepEqual(missingHtml, []);
  assert.deepEqual(missingRenderer, []);
  assert.equal(translate("Настройки", "en"), "Settings");
  assert.equal(translate("приложения", "en"), "application");
  assert.equal(translate("16 установлено · 16 в каталоге", "en"), "16 installed · 16 in catalog");
  assert.equal(translate("Avelune Natural 4× готов к обработке.", "en"), "Avelune Natural 4× is ready for processing.");
});

test("renderer retranslates dynamic panels when language changes", () => {
  assert.match(renderer, /function trUi\(value\)/);
  assert.match(renderer, /function translateSubtree\(root = document\.body\)/);
  assert.match(renderer, /function refreshLocalizedViews\(\)/);
  assert.match(renderer, /window\.addEventListener\("avelune-language-change", refreshLocalizedViews\)/);
  assert.match(renderer, /new Intl\.DateTimeFormat\(activeIntlLocale\(\)/);
  assert.match(renderer, /toast\.innerHTML = .*trUi\(title\).*trUi\(message\)/);
  assert.match(renderer, /translateSubtree\(els\.modelCatalogGrid\)/);
  assert.match(renderer, /translateSubtree\(els\.profileChoiceGrid\)/);
  assert.match(renderer, /translateSubtree\(els\.historyList\)/);
  assert.match(renderer, /translateSubtree\(els\.batchQueueList\)/);
});

test("expanded locale matrix includes Kazakh aliases and RTL languages", () => {
  const sandbox = {
    window: {},
    document: { body: null, documentElement: { lang: "ru", dataset: {} } },
    navigator: { languages: ["kk-KZ"], language: "kk-KZ" },
    MutationObserver: function MutationObserver() {},
    CustomEvent: function CustomEvent() {},
    requestAnimationFrame: callback => callback(),
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
  };
  sandbox.window.dispatchEvent = () => {};
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(i18n, sandbox);

  const api = sandbox.window.aveluneI18n;
  assert.equal(api.detectLanguage(), "kk");
  assert.equal(api.resolveLanguage("kk-KZ"), "kk");
  assert.equal(api.resolveLanguage("zh-Hant"), "zh-TW");
  assert.equal(api.resolveLanguage("no-NO"), "nb");
  assert.equal(api.resolveLanguage("iw"), "he");
  assert.equal(api.translate("Настройки", "kk"), "Баптаулар");
  assert.equal(api.translate("Выберите AI-профиль", "kk"), "AI профилін таңдаңыз");
  assert.equal(api.translate("Пакет не установлен", "kk"), "Пакет орнатылмаған");
  api.setLanguage("he");
  assert.equal(sandbox.document.documentElement.dir, "rtl");
});

test("generated locale packs cover every visible UI source without token leaks", () => {
  const sandbox = createI18nSandbox("kk-KZ");
  const injected = i18n.replace(
    "window.aveluneI18n = Object.freeze({",
    "window.__translations = TRANSLATIONS; window.__generated = GENERATED_TRANSLATIONS; window.__patterns = DYNAMIC_PATTERNS; window.aveluneI18n = Object.freeze({"
  );
  const auditSandbox = {
    window: {},
    document: { body: null, documentElement: { lang: "ru", dataset: {}, dir: "ltr" } },
    navigator: { languages: ["kk-KZ"], language: "kk-KZ" },
    MutationObserver: function MutationObserver() {},
    CustomEvent: function CustomEvent() {},
    requestAnimationFrame: callback => callback(),
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
  };
  auditSandbox.window.dispatchEvent = () => {};
  auditSandbox.window.addEventListener = () => {};
  vm.createContext(auditSandbox);
  vm.runInContext(injected, auditSandbox);

  const api = auditSandbox.window.aveluneI18n;
  const generated = auditSandbox.window.__generated;
  const templates = auditSandbox.window.__patterns.map(pattern => pattern.template).filter(Boolean);
  const sources = [...new Set([
    ...Object.keys(auditSandbox.window.__translations.en),
    ...htmlRussianSources(),
    ...rendererRussianStringCandidates(),
    ...templates
  ])].filter(source => /[\u0400-\u04FF]/.test(source));
  const samples = templates.map(template => template.replace(/\{(\d+)\}/g, (_, index) => ["1", "2", "PNG", "3", "00:30"][Number(index)] || "1"));
  const acceptedKazakhMatches = new Set(["ГБ", "мс", "Аниме", "{0} ГБ"]);

  for (const [locale] of api.languages) {
    if (["auto", "ru", "en"].includes(locale)) continue;
    const missing = sources.filter(source => !generated[locale]?.[source]);
    assert.deepEqual(missing, [], `${locale} has untranslated source keys`);

    const leaked = [...sources, ...samples]
      .map(source => api.translate(source, locale))
      .filter(value => /AVTOKEN|AVELUNE_I18N_SEPARATOR/.test(value));
    assert.deepEqual(leaked, [], `${locale} leaked generation placeholders`);
  }

  const kazakhRussianLeftovers = sources.filter(source => (
    !acceptedKazakhMatches.has(source)
    && api.translate(source, "kk") === source
    && api.translate(source, "en") !== source
  ));
  assert.deepEqual(kazakhRussianLeftovers, []);
  assert.equal(api.translate("Интерфейс", "kk"), "Қолданба көрінісі");
  assert.equal(api.translate("Масштаб", "kk"), "Үлкейту");
  assert.equal(api.translate("Формат", "kk"), "Пішім");
});
