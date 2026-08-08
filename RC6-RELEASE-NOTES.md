# Avelune Enhance 2.0.0 RC6 — release notes

RC6 переводит Avelune от преимущественно интерфейсного обновления к функциональному релизу качества и производительности.

## Новое

1. Шесть проверяемых официальных NCNN-моделей и одиннадцать прозрачных профилей.
2. Локальный Auto Profile с объяснением рекомендации и безопасным fallback-чтением пикселей.
3. Адаптивный просмотр результата с точным ползунком «До/После», безопасным file/clipboard preview и проверкой геометрии на разных размерах окна/DPI.
4. Smart Queue: состояния файлов, пауза, продолжение, повтор ошибок, удаление, открытие результата, skip-existing и continue-on-error.
5. Консервативное встроенное Neural Restore через RealESRNet/Real-ESRGAN и отдельные скачиваемые Photo Restore Pro/Ultra-пакеты для GFPGAN/DiffBIR-каскадов.
6. Безопасное сохранение совместимых EXIF/XMP/IPTC/ICC-блоков для JPEG, PNG и extended WebP.
7. GPU AutoTune, benchmark и автоматические повторы с меньшим tile size при OOM/device-lost.
8. Новый packaged QA gate с несколькими разрешениями/DPI, JSON-диагностикой, PNG-скриншотами и сохранением артефактов в `QA-FAILED`.
9. Обновлённый логотип и Windows icon assets.

## Ограничения кандидата

- Встроенный Neural Restore не является GFPGAN и не выполняет генеративную подмену черт; GFPGAN/DiffBIR доступны только в отдельно устанавливаемых локальных Photo Restore Pro/Ultra-пакетах.
- TIFF и настоящий сквозной 16-битный AI-пайплайн не заявлены в RC6.
- Дополнительные официальные модели загружаются и проверяются во время Windows-сборки; обычная работа приложения остаётся локальной.
- Публичный релиз остаётся заблокирован до Authenticode-подписи и финального антивирусного сканирования.

## Сборка

Готовые Windows-файлы публикуются в GitHub Releases как `Setup`, `Portable`, update metadata и `SHA256SUMS.txt`.

Для воспроизводимой сборки из исходников запустите:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-rc6-release.ps1
```

Локальные файлы и QA-отчёты появятся в `RC6-OUTPUT`.
