# Уведомления о сторонних компонентах

Avelune Enhance 2.0 является существенно изменённым производным проектом открытого приложения Upscayl. Интерфейс, бренд и пользовательские сообщения используют идентичность Avelune; эта документация сохраняет требуемую атрибуцию.

## Исходное настольное приложение

- Проект: Upscayl
- Историческая основа: ветка 2.15.x
- Лицензия: GNU Affero General Public License v3.0
- Исходный проект: `https://github.com/upscayl/upscayl`

Avelune не связана с первоначальными сопровождающими Upscayl и не одобрена ими.

## Real-ESRGAN и RealESRNet

RC6 использует официальные NCNN-модели из закреплённого пакета Real-ESRGAN v0.2.5.0:

- `realesrgan-x4plus` — распространяется внутри Avelune под совместимым техническим именем `avelune-standard-4x`, но остаётся сторонней моделью;
- `realesrgan-x4plus-anime` — распространяется под техническим именем `digital-art-4x`, но остаётся сторонней моделью;
- `realesrnet-x4plus`;
- `realesr-animevideov3-x2`;
- `realesr-animevideov3-x3`;
- `realesr-animevideov3-x4`.

Названия Natural, Restore, Neural Restore, Photo Restore Pro, Photo Restore Ultra, Art, Anime Video, Fast и Detail+ являются **профилями Avelune**, а не заявлениями об авторстве AI-весов.

- Проект: Real-ESRGAN
- Авторы: Xintao Wang и участники
- Лицензия: BSD 3-Clause
- Исходный проект: `https://github.com/xinntao/Real-ESRGAN`
- Закреплённый пакет: `realesrgan-ncnn-vulkan-20220424-windows.zip`

Builder проверяет SHA-256 архива, byte-for-byte соответствие двух ранее переименованных пар официальным файлам и создаёт `official-model-manifest.json` с SHA-256 установленных моделей. Текст лицензии находится в `licenses/REAL-ESRGAN-BSD-3-Clause.txt`.

### Официальные демонстрационные изображения

Окно выбора профиля может включать материалы из официальной документации Real-ESRGAN:

- `assets/teaser.jpg` для RealESRGAN x4plus;
- `cmp_realesrgan_anime_1.png` для RealESRGAN x4plus Anime 6B.

Материалы загружаются во время сборки, сохраняются локально и не требуют сети при обычной работе приложения. При отсутствии доступа используется явно обозначенная абстрактная SVG-заглушка Avelune, которая не выдаётся за результат модели. Права на исходные изображения остаются у соответствующих правообладателей.

## Нативный NCNN/Vulkan-движок

Движок основан на открытом NCNN/Vulkan backend. Соответствующий исходный код и изменения Avelune включены в `native-engine-source`.

В состав нативного движка входят:

- NCNN — BSD 3-Clause и дополнительные уведомления;
- libwebp — BSD 3-Clause;
- STB — лицензии, включённые в соответствующий исходный архив.

Тексты лицензий находятся в каталоге `licenses`.

## Electron и Chromium

Собранные приложения включают Electron, Chromium, Node.js и транзитивные компоненты. Применимые уведомления поставляются вместе с приложением и исходным архивом.
