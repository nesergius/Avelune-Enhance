# Avelune Enhance 2.0.0 RC6 — release notes

RC6 переводит Avelune от преимущественно интерфейсного обновления к функциональному релизу качества и производительности.

## English summary

RC6 turns Avelune Enhance into a local Windows AI image enhancement and restoration release focused on practical image quality, clear profiles and private local processing.

- 11 clear AI profiles for photos, old photo recovery, portraits, game screenshots, anime, art, fast processing and maximum detail.
- Smart Restore / Auto Profile recommends a local profile from image signals and available hardware.
- Photo Restore Pro and Photo Restore Ultra add optional local restoration packages for heavier recovery tasks.
- The adaptive Before/After viewer keeps result comparison aligned across window sizes and DPI.
- Setup, Portable and SHA-256 checksums are published through GitHub Releases.

## Новое

1. Одиннадцать понятных AI-профилей для фото, старых снимков, портретов, игровых изображений, аниме, арта, быстрой обработки и максимальной детализации.
2. Smart Restore / Auto Profile рекомендует локальный профиль по изображению и доступному железу.
3. Photo Restore Pro и Photo Restore Ultra добавляют опциональные локальные restoration-пакеты для тяжёлых задач восстановления.
4. Адаптивный просмотр «До/После» сохраняет симметричное сравнение результата на разных размерах окна и DPI.
5. Smart Queue поддерживает пакетную обработку с прогрессом, паузой, продолжением, повтором ошибок и пропуском готовых результатов.
6. Встроенные локальные профили обрабатывают изображения на компьютере и не отправляют их в облако.
7. Безопасное сохранение совместимых EXIF/XMP/IPTC/ICC-блоков для JPEG, PNG и extended WebP.

## Ограничения кандидата

- Встроенный Neural Restore не является GFPGAN и не выполняет генеративную подмену черт; GFPGAN/DiffBIR доступны только в отдельно устанавливаемых локальных Photo Restore Pro/Ultra-пакетах.
- TIFF и настоящий сквозной 16-битный AI-пайплайн не заявлены в RC6.
- Опциональные restoration-пакеты устанавливаются отдельно через AI Package Manager.
- Публичный релиз остаётся заблокирован до Authenticode-подписи и финального антивирусного сканирования.

## Сборка

Готовые Windows-файлы публикуются в GitHub Releases как `Setup`, `Portable`, update metadata и `SHA256SUMS.txt`.

Для воспроизводимой сборки из исходников запустите:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-rc6-release.ps1
```

Локальные файлы и QA-отчёты появятся в `RC6-OUTPUT`.
