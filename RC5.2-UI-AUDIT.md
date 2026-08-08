# RC5.2 UI and runtime audit

## Цель

Убрать ощущение «плавающего» интерфейса и сделать основной поток таким же
предсказуемым, как в зрелом desktop-приложении: одна панель действий и одна
неподвижная рабочая область.

## Геометрия

Проверено в инициализированном renderer:

| Viewport | Document scroll | Default controls scroll | Preview |
|---|---:|---:|---:|
| 1366 × 768 | нет | нет | 1018 px |
| 1280 × 720 | нет | нет | 932 px |

При меньшей высоте прокручивается только `.controls-scroll`. Canvas,
preview-card и drop-zone остаются неподвижными.

## Clipboard preview

В browser-level runtime audit проверены два отдельных пути:

1. недоступный primary URL → binary IPC fallback → preview `1 × 1`;
2. две вставки подряд с ответами в обратном порядке → остаётся последняя
   вставка и соответствующий ей путь.

Оба сценария прошли.

## Scroll benchmark

После раскрытия Advanced:

- p95 frame: 16.8 ms;
- maximum frame: 16.8 ms;
- cumulative layout shift во время прокрутки: 0;
- JavaScript wheel interception: отсутствует.

Это локальный Chromium audit. Финальным источником истины остаются packaged
Windows probes, встроенные в release builder.

## Packaged acceptance

Сборка не получает `Success: true`, пока не пройдут:

- startup probe;
- clipboard preview probe;
- zero-scroll geometry 1366 × 768;
- zero-scroll geometry 1280 × 720;
- scroll frame pacing и layout stability;
- packaged engine smoke test;
- Source Snapshot preflight.
