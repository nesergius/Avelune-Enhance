# Avelune Enhance RC6 — runtime QA

## Автоматически

Запустить `BUILD_RC6_WINDOWS.cmd` и убедиться, что создан `RC6-OUTPUT` без папки `QA-FAILED`.

Проверяются:

- integrity моделей и нативных файлов;
- полный набор Node tests;
- запуск packaged app;
- clipboard preview;
- отсутствие глобальной прокрутки;
- sidebar/workspace geometry;
- frame pacing и layout shift;
- 1280×720 @100%;
- 1366×768 @100%;
- 1920×1080 @100%;
- 1366×768 @125%;
- 1920×1080 @150%;
- нативная обработка benchmark fixture.

## Вручную

1. Проверить Auto Profile на фото, JPEG-артефактах и аниме.
2. Проверить preview области и повторное открытие из кэша.
3. Проверить Natural, Restore, Art и Anime Video на реальных изображениях.
4. Проверить pause/resume очереди минимум из 20 файлов.
5. Проверить retry failed и skip existing.
6. Проверить отмену одиночной и пакетной задачи.
7. Проверить OOM fallback на большом изображении/низком tile.
8. Проверить EXIF/ICC на JPEG и PNG через внешний metadata inspector.
9. Проверить, что face refinement не меняет черты агрессивно.
10. Проверить установщик и Portable на чистом Windows-профиле.

## Перед публикацией

- Authenticode + timestamp;
- Microsoft Defender scan;
- дополнительный multi-engine scan;
- NVIDIA/AMD/Intel Vulkan smoke matrix;
- проверка update metadata на приватном RC-канале;
- публикация source snapshot и SHA256SUMS.
