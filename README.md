# Report UAV / Звіт БПЛА

**Report UAV** — lightweight single-page web application for creating structured UAV mission reports in the browser.
Designed for fast field reporting from mobile devices. Works offline, keeps all data on the user's device.

**Звіт БПЛА** — легкий односторінковий веб-додаток для формування структурованих звітів місій БПЛА прямо в браузері.
Розрахований на швидке польове звітування з телефону чи планшета. Працює офлайн, усі дані зберігаються лише на пристрої.

---

## Features / Можливості

| Feature | Description |
|---|---|
| **Structured reports** | Form: crew, counter, date, drone, mission type, takeoff time, impact/loss time, MGRS coordinates, ammo, stream, result |
| **Journal & statistics** | Period filter, KPI dashboard (sorties, hits, losses, efficiency), tabs, search, cards with Copy / Share |
| **Interactive map** | Mission markers grouped by MGRS coordinate; dot for single missions, badge with count for groups; two-level overlay viewer |
| **Encrypted export / import** | AES-256-GCM + PBKDF2 encrypted JSON file; deduplicated merge on import; portable between devices |
| **Result normalization** | Raw result strings mapped to standard categories for accurate statistics |
| **Mobile-first & PWA** | Responsive dark theme, large tap targets, installable as a home screen app |
| **Offline-ready** | Service Worker caches all assets — works without network after first load |
| **Local-only storage** | No backend, no telemetry. History, counter, settings live only in browser localStorage |
| **Configurable lists** | Drones, mission types, ammo, results, MGRS prefixes, streams — all editable in Settings |
| **Long-press navigation** | Long-press the header to open screen menu |
| **Crew counter** | Numeric 1–25, auto-increments after each report, persists between sessions |
| **Empty field alerts** | Required fields highlighted with red glow when left empty |

---

## Screens / Екрани

### 1. Форма звіту (Main form)

Головний екран. Поля форми:

- **Екіпаж** — позивний екіпажу (текст) + **лічильник** (1–25, зберігається між сесіями, автоінкремент після формування звіту)
- **Дата** — дата місії (date picker)
- **Борт** — вибір зі списку або утримати для вільного вводу
- **Характер** — тип місії (вибір або вільний ввод)
- **Час зльоту** — з кнопкою «Зараз»
- **Час ураження/втрати** — з кнопкою «Зараз»
- **Координати** — MGRS (префікс + easting + northing, по 5 цифр)
- **Боєприпас** — вибір або вільний ввод
- **Стрім** — посилання або "---"
- **Результат** — вибір або вільний ввод

Кнопка **«Готово»** формує текст звіту, копіює його в буфер обміну та зберігає в журнал.

### 2. Журнал та статистика (Journal & statistics)

- **Фільтр за періодом** — дата та час початку/кінця (за замовчуванням — поточний місяць). Фільтрація за полем «Час ураження/втрати».
- **KPI-панель** — вильотів, уражень, втрат, ефективність (%).
- **Вкладка «Статистика»** — зведення по бортах, боєприпасах, типах місій та результатах (з нормалізацією категорій).
- **Вкладка «Журнал»** — список звітів картками, пошук по тексту, Copy / Share для кожного звіту, Copy all.
- **Передача даних** — секція внизу екрана:
  - **Експорт** — шифрує історію звітів (AES-256-GCM, ключ через PBKDF2) і зберігає як `uav_reports.enc.json`. Подвійне підтвердження ключа.
  - **Імпорт** — зчитує зашифрований файл, перевіряє версію, структуру та кожен запис. Зливає з існуючою історією без дублів (дедуплікація за `ts + text`).

### 3. Карта місій (Map)

- Маркери з координатами MGRS зі звітів обраного періоду.
- **Одна місія** — компактна цианова точка. Клік → overlay-карточка звіту.
- **Декілька місій в одній точці** — круглий бейдж з числом:
  - 2–3: зелений
  - 4–5: лаймовий
  - 6+: янтарно-оранжевий
- Клік по бейджу → overlay зі списком місій (відсортовані за часом). Клік по місії → карточка звіту. Кнопка «Назад» повертає до списку.
- Карточка звіту: текст, «Копіювати», «Поділитися».

### 4. Налаштування списків (Settings)

Редактор локальних списків, що мають пріоритет над `config.json`:

- Дрони
- Типи місій
- Боєприпаси
- Результати
- Префікси MGRS
- Стріми

Drag-and-drop для порядку. Зміни зберігаються в `localStorage` і застосовуються одразу.

### 5. Довідка та контакти (Help & contacts)

Інструкція по роботі з додатком та контакти розробника.

---

## Instructions / Інструкція

### Як створити звіт

1. Відкрийте додаток (головний екран — Форма звіту).
2. Заповніть поля. У полях з випадаючим списком (Борт, Характер, Боєприпас, Результат) можна **утримати** для переходу у вільний ввод.
3. Для швидкого вводу часу натисніть **«Зараз»** біля полів часу.
4. Координати вводяться у форматі MGRS: виберіть префікс, введіть easting (5 цифр) і northing (5 цифр).
5. Натисніть **«Готово»** — текст звіту з'явиться в полі «Готовий результат» і буде автоматично скопійований в буфер обміну.
6. Лічильник екіпажу збільшиться автоматично. Він зберігається між сесіями.

### Як переглянути історію та статистику

1. Довге натискання на заголовок → меню → **«Журнал та статистика»**.
2. За замовчуванням показано поточний місяць. Змініть дати/час і натисніть **«Показати»**.
3. **KPI-панель** зверху показує ключові метрики.
4. Перемикайтесь між **«Статистика»** (зведення) та **«Журнал»** (список звітів).
5. У журналі: пошук, Copy / Share для кожного звіту, Copy all.

### Як працювати з картою

1. Меню → **«Карта»**.
2. Маркери відповідають координатам зі звітів за обраний період.
3. Одиночна точка — клік відкриває звіт.
4. Бейдж з числом — клік відкриває список місій у цій точці, далі — вибір конкретної місії.

### Як експортувати дані

1. На екрані журналу, секція **«Передача даних»** внизу.
2. Натисніть **«Експорт»**.
3. Введіть ключ шифрування → підтвердіть його повторно.
4. Файл `uav_reports.enc.json` буде завантажений. Зберігайте файл і ключ окремо.

### Як імпортувати дані

1. Натисніть **«Імпорт»** → виберіть `.json` файл.
2. Введіть ключ, яким файл був зашифрований.
3. Звіти з файлу буде злито з існуючою історією без дублікатів.
4. Журнал і карта оновляться автоматично.

### Як змінити списки

1. Меню → **«Налаштування списків»**.
2. Виберіть вкладку (Дрони, Боєприпаси тощо).
3. Додайте, видаліть або перетягніть елементи.
4. Натисніть 💾 для збереження. Зміни застосовуються одразу.

### Навігація

Довге натискання на заголовок **«Звіт по БПЛА»** відкриває меню екранів. Активний екран підсвічується.

---

## Project structure / Структура проєкту

```text
Report-UAV/
├── index.html              # Main page (loads js/app.js as ES module)
├── styles.css              # Dark theme, responsive layout, map markers, overlays
├── config.json             # Base lists and default values
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline caching)
├── LICENSE                 # MIT
├── README.md
│
└── js/
    ├── app.js              # Entry point: init all screens and navigation
    ├── constants.js         # Storage keys, limits, config URL
    ├── utils.js             # DOM helpers, date/time utils, status, textarea autosize
    ├── counter.js           # Crew counter (1–25): parse, load/save
    ├── coords.js            # Coordinate normalization, MGRS string builder
    ├── clipboard.js         # Copy via Clipboard API or AndroidBridge
    ├── config.js            # Load config.json, apply overrides, fill selects/datalists
    ├── history.js           # loadReports / saveReports / addReport (localStorage)
    ├── filters.js           # Shared period filter, impact timestamp extraction
    ├── result-mapping.js    # Normalize result strings to standard categories
    ├── longPressEdit.js     # Long-press on <select> → free-text input
    ├── generate.js          # Build report text, copy, save, increment counter
    ├── streams.js           # Known stream values persistence
    ├── navigation.js        # Screen switching, long-press menu
    │
    ├── crypto/
    │   ├── crypto.js        # AES-GCM + PBKDF2 encrypt/decrypt
    │   └── importExport.js  # Export/import encrypted reports with validation and merge
    │
    └── screens/
        ├── mainForm.js      # Main report form bindings
        ├── journal.js       # Journal, statistics, KPI, search, cards, export/import UI
        ├── map.js           # Leaflet map, grouped markers, two-level overlay viewer
        └── settings.js      # Lists editor (tabs, drag-and-drop, quick save)
```

---

## Configuration / Конфігурація

- **`config.json`** — base lists (`drones`, `missionTypes`, `ammo`, `results`, `mgrsPrefixes`) and defaults (`mgrsPrefix`, `missionType`, `result`).
- **Local overrides** — stored in `localStorage`, edited via Settings screen, take priority over `config.json`.

---

## Running locally / Запуск

Serve over HTTP:

```bash
npx serve .
```

Do **not** open `index.html` via `file://` — ES modules require HTTP.

---

## Privacy & security / Конфіденційність та безпека

- No backend, no telemetry, no external APIs.
- All data (reports, settings, counter) stored **only** in browser `localStorage`.
- Encrypted export uses **AES-256-GCM** with key derived via **PBKDF2** (SHA-256, 250 000 iterations).
- Encryption key is never stored — entered by user at export/import time.

---

## Developer / Розробник

Telegram: [t.me/irreligious_86](https://t.me/irreligious_86)
Email: [irreligious86@gmail.com](mailto:irreligious86@gmail.com)
GitHub: [github.com/irreligious86/Report-UAV](https://github.com/irreligious86/Report-UAV)

---

## License / Ліцензія

MIT — see [`LICENSE`](LICENSE).

---

<div align="center">

**Report UAV** — field-tested, offline-first, privacy-respecting.

Built for operators. No servers. No tracking. Your data stays yours.

`AES-256-GCM` · `PBKDF2` · `MGRS` · `Leaflet` · `PWA` · `localStorage`

</div>
