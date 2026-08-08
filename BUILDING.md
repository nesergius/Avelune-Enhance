# Сборка Avelune Enhance 2.0.0 RC6

## Для пользователей

Готовые Windows-файлы публикуются как GitHub Release assets:

- `Avelune-Enhance-2.0.0-RC6-Setup-x64.exe`;
- `Avelune-Enhance-2.0.0-RC6-Portable-x64.exe`;
- `SHA256SUMS.txt`.

Не коммитьте собранные `.exe` в исходный репозиторий: они должны жить в Releases или CI artifacts.

## Сборка из исходников

Распакуйте исходники в новую папку и запустите:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-rc6-release.ps1
```

## Что делает release builder

1. Определяет установленный Node.js/npm или подготавливает поддерживаемое окружение.
2. Загружает официальные демонстрационные примеры профилей; при недоступности сети оставляет локальные SVG-заглушки.
3. Загружает закреплённый официальный пакет Real-ESRGAN NCNN v0.2.5.0.
4. Проверяет SHA-256 архива и byte-for-byte соответствие двух ранее переименованных моделей официальным файлам.
5. Добавляет distinct-модели RealESRNet и AnimeVideo v3 2×/3×/4×.
6. Формирует и проверяет `resources/resource-manifest.json`.
7. Создаёт source snapshot **до** `npm ci`, чтобы `node_modules`, кэши и результаты сборки не попали в исходный архив.
8. Выполняет `npm ci` и `npm test`.
9. Собирает Setup x64 и Portable x64.
10. Выполняет packaged runtime probe, матрицу UI/DPI-проб и smoke test нативного движка.
11. Создаёт upload-map, release manifest и SHA256SUMS.

## Сетевой доступ

При первой сборке требуется доступ к официальным GitHub Releases и npm registry. Загруженный пакет моделей сохраняется в `.build-tools/official-models` и повторно используется после проверки SHA-256.

Кэш `.build-tools` не включается в source snapshot. Сами проверенные модели включаются в итоговую поставку и её манифест ресурсов.

## Команды разработчика

```text
npm ci
npm start
npm test
npm run manifest:resources
npm run verify:resources
npm run dist:win
```

`npm start`, `npm run release:win` и release-builder сначала подготавливают официальные модели и демонстрационные материалы.

## Результаты

При успехе откройте `RC6-OUTPUT`.

При провале visual QA собранные артефакты не теряются. Они помещаются в:

```text
RC6-OUTPUT\QA-FAILED
```

Там сохраняются Setup, Portable, update metadata, JSON-метрики, PNG-скриншоты и `QA-FAILURES.txt`.

## Подпись

Для официального публичного релиза требуется Authenticode-сертификат и timestamp. Electron Builder использует:

- `CSC_LINK`;
- `CSC_KEY_PASSWORD`.

Неподписанный RC6 предназначен для локальной проверки и не должен публиковаться как окончательный стабильный релиз.


## RC6 official model downloads

The RC6 builder downloads the pinned v0.2.5.0 NCNN package for current AnimeVideo-v3 files. Because its Windows asset omits RealESRNet, the builder downloads the official v0.2.3.0 package only for `realesrnet-x4plus.bin` and `.param`, then verifies those exact files with pinned SHA-256 values. Both downloads are cached under `.build-tools/official-models`.
