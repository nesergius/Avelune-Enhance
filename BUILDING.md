# Сборка Avelune Enhance

## Требования

- Node.js 22 LTS или новее;
- npm с поддержкой `npm ci`;
- для подписанной Windows-сборки — действующий Authenticode code-signing сертификат;
- Windows runner рекомендуется для финальной подписанной сборки и release-gate тестов.

## Воспроизводимая сборка

1. Распаковать точный исходный архив версии релиза.
2. Выполнить `npm ci` — версии зависимостей закреплены в `package-lock.json`.
3. Выполнить `npm test` и `npm run verify`.
4. Запустить `npm run dist:win`.
5. Проверить SHA-256 артефактов и Authenticode-подпись.

## Подпись

Electron Builder использует стандартные переменные:

- `CSC_LINK` — путь/URL/base64 сертификата;
- `CSC_KEY_PASSWORD` — пароль сертификата.

Для release pipeline также устанавливается `AVELUNE_REQUIRE_SIGNING=1`; без сертификата проверка релиза завершается ошибкой.

## Манифест ресурсов

После законной замены движка или моделей выполнить:

```bash
npm run manifest:resources
npm run verify
```

Изменение `resources/resource-manifest.json` без одновременного обновления соответствующих файлов запрещено.


## DXGI helper

`tools/avelune-gpu-info.cpp` is compiled for Windows x64 and packaged as
`resources/win/bin/avelune-gpu-info.exe`.

Example cross-compile:

```bash
x86_64-w64-mingw32-g++ -std=c++17 -O2 -s -static   -static-libgcc -static-libstdc++ -municode   tools/avelune-gpu-info.cpp -o resources/win/bin/avelune-gpu-info.exe   -ldxgi -lole32
```

## Проверка ресурсов RC4

Перед каждой Windows-сборкой выполнить:

```bash
npm run manifest:resources
npm run verify
```

esources/resource-manifest.json создаётся детерминированно и содержит
размер и SHA-256 нативного движка, вспомогательных EXE/DLL и всех моделей.
После любого изменения ресурсов манифест необходимо сформировать заново.

## Проверка ресурсов RC4

Перед каждой Windows-сборкой выполнить:

```bash
npm run manifest:resources
npm run verify
```

esources/resource-manifest.json создаётся детерминированно и содержит
размер и SHA-256 нативного движка, вспомогательных EXE/DLL и всех моделей.
После любого изменения ресурсов манифест необходимо сформировать заново.

## Проверка ресурсов RC4

Перед каждой Windows-сборкой выполнить:

```bash
npm run manifest:resources
npm run verify
```

esources/resource-manifest.json создаётся детерминированно и содержит
размер и SHA-256 нативного движка, вспомогательных EXE/DLL и всех моделей.
После любого изменения ресурсов манифест необходимо сформировать заново.

## Проверка ресурсов RC4

Перед каждой Windows-сборкой выполнить:

```bash
npm run manifest:resources
npm run verify
```

esources/resource-manifest.json создаётся детерминированно и содержит
размер и SHA-256 нативного движка, вспомогательных EXE/DLL и всех моделей.
После любого изменения ресурсов манифест необходимо сформировать заново.

## Native engine Corresponding Source

The exact modified source and initialized submodules are packaged in:


ative-engine-source/Avelune-Native-Engine-Corresponding-Source-2.0.0-RC4.zip

Review:

- NATIVE_ENGINE_SOURCE.md
- NATIVE_ENGINE_SOURCE.json
- 
ative-engine-source/AVELUNE_ENGINE_MODIFICATIONS.md
- 
ative-engine-source/REBUILD-AVELUNE-ENGINE.md
- 
ative-engine-source/avelune-engine-source.patch