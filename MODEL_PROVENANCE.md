# Avelune Enhance — происхождение AI-моделей и профилей

Версия: **2.0.0 RC6**

## Правило каталога

Названия Avelune Natural, Restore, Art и другие — это профили приложения. Они не означают, что сторонние AI-веса были обучены Avelune. Интерфейс показывает реальную базовую модель и статус проверки.

## Встроенные проверяемые модели

### `avelune-standard-4x`

- Официальный файл: `realesrgan-x4plus`.
- Проект: Real-ESRGAN.
- Лицензия: BSD 3-Clause.
- Файл Avelune обязан быть byte-for-byte идентичен официальному файлу из закреплённого пакета.

### `digital-art-4x`

- Официальный файл: `realesrgan-x4plus-anime` / RealESRGAN x4plus Anime 6B NCNN.
- Проект: Real-ESRGAN.
- Лицензия: BSD 3-Clause.
- Файл Avelune обязан быть byte-for-byte идентичен официальному файлу из закреплённого пакета.

### `realesrnet-x4plus`

- Официальная модель RealESRNet x4plus.
- Назначение: более консервативное и верное исходнику восстановление.
- Лицензия: BSD 3-Clause.

### `realesr-animevideov3-x2`
### `realesr-animevideov3-x3`
### `realesr-animevideov3-x4`

- Официальные модели AnimeVideo v3 для соответствующих масштабов.
- Назначение: анимационные кадры и последовательности.
- Лицензия: BSD 3-Clause.

## Закреплённый источник

Builder использует два официальных пакета:

```text
Real-ESRGAN v0.2.5.0 / realesrgan-ncnn-vulkan-20220424-windows.zip
Real-ESRGAN v0.2.3.0 / realesrgan-ncnn-vulkan-20211212-windows.zip
```

Пакет v0.2.5.0 используется для актуальных AnimeVideo-v3 и уже встроенных RealESRGAN-моделей. Его архив проверяется по закреплённому SHA-256. Windows-архив v0.2.5.0 не содержит RealESRNet, поэтому только `realesrnet-x4plus.bin` и `.param` берутся из официального пакета v0.2.3.0 и проверяются по закреплённым SHA-256 каждого файла. После установки `official-model-manifest.json` фиксирует источник, размер и SHA-256 каждого добавленного файла. Затем общий `resources/resource-manifest.json` защищает модели в упакованном приложении.

## Профили RC6

- `avelune-natural` → `avelune-standard-4x`;
- `avelune-game` → `avelune-standard-4x`, профиль без face/diffusion для игровых скриншотов, UI и текстур;
- `avelune-smart-restore` → runtime-анализ изображения и GPU → выбор одного из существующих локальных pipeline;
- `avelune-restore` → `realesrnet-x4plus`;
- `avelune-neural-restore` → `realesrnet-x4plus` → `avelune-standard-4x`;
- `avelune-generative-restore` / **Photo Restore Pro** → GFPGAN 1.4 + Real-ESRGAN local package → `avelune-standard-4x` final TTA upscale;
- `avelune-photo-restore-ultra` → DiffBIR v2.1 + GFPGAN + Real-ESRGAN local package → `avelune-standard-4x` final TTA upscale;
- `avelune-art` → `digital-art-4x`;
- `avelune-anime-video` → AnimeVideo v3 2×/3×/4× по выбранному масштабу;
- `avelune-fast` → `avelune-standard-4x`, целевой вывод 2×;
- `avelune-detail-plus` → `avelune-standard-4x` с TTA.

Дубли `avelune-balanced` и `avelune-smooth` удалены из основного каталога профилей. Для совместимости старые сохранённые настройки автоматически перенаправляются соответственно на `avelune-natural` и `avelune-restore`.

## Восстановление лиц

RC6 поддерживает скачиваемые локальные пакеты восстановления:

- **Photo Restore Pro**: GFPGAN 1.4 + RealESRGAN_x4plus для лиц и фона.
- **Photo Restore Ultra**: DiffBIR v2.1 + Stable Diffusion 2.1 + GFPGAN + RealESRGAN_x4plus.

Эти пакеты не входят в базовый lightweight-набор NCNN-весов и устанавливаются отдельно через AI Package Manager. Профили Avelune используют их только при включённом `generativeRestore`.

## Пользовательские модели

Пользователь может подключить совместимую пару `.bin` + `.param`. Avelune не заявляет авторство, не гарантирует лицензионную чистоту и не помечает такие модели как официальные.
