# Report UAV

**Report UAV** is a lightweight single-page web application for creating structured UAV (drone) mission reports directly in the browser.  
It is optimized for fast field reporting on mobile devices, works offline after the first load, and keeps all data on the user’s device.

---

**Звіт БПЛА** — це легка односторінкова веб-програма для створення структурованих звітів місій БПЛА прямо в браузері.  
Вона розрахована на швидке польове звітування з мобільних пристроїв, працює офлайн після першого завантаження та зберігає всі дані локально на пристрої користувача.

---

## Features

- **Structured mission reports**  
  Create UAV mission reports using a form with: crew, crew counter, date, drone type, mission type, takeoff time, impact/loss time, MGRS-style coordinates (prefix + easting + northing), ammo, stream, and result.

- **Mobile-first & PWA-friendly**  
  Layout is tuned for phones and tablets, large tap targets, and use as a Progressive Web App (PWA).

- **Offline-ready**  
  A Service Worker caches static assets (`sw.js`), so after the first HTTP load the app can be used without network connectivity.

- **Local-only data**  
  There is no backend or external API.  
  Configuration comes from `config.json`, while report history, crew counter and user list overrides are stored only in `localStorage`.

- **Configurable lists without touching code**  
  Base lists (drones, mission types, ammo, results, MGRS prefixes) live in `config.json`.  
  A dedicated “Settings” screen lets the user override these lists locally (plus manage streams) without editing files on disk.

- **Multi-screen navigation via long-press**  
  Long-press the top header to open a screen menu with:
  - Main form (report form),
  - Journal & statistics,
  - Settings (lists),
  - Help & contacts.  
  The currently active screen is highlighted in the menu.

- **Copy to clipboard (and optional Android integration)**  
  Each generated report is written into the “output” area and copied to the clipboard.  
  In environments exposing `AndroidBridge`, sharing can be integrated additionally.

- **Crew counter**  
  Optional numeric counter (1–25) tied to the crew, stored between sessions.  
  After pressing “Done”, the counter can be automatically incremented for the next sortie.

- **Empty-field highlighting**  
  Important fields are automatically marked with a red border and glow when left empty, reducing the chance of missing required information.

---

## Можливості (українською)

- **Структуровані звіти місій**  
  Форма дозволяє створювати звіти по місії БПЛА з полями: екіпаж, лічильник екіпажу, дата, борт, характер місії, час зльоту, час ураження/втрати, координати MGRS (префікс + easting + northing), боєприпас, стрім і результат.

- **Оптимізація під мобільні та PWA**  
  Інтерфейс спроєктований для телефонів і планшетів, з великими зонами натискання та можливістю встановлення як веб-додаток (PWA).

- **Робота офлайн**  
  Після першого завантаження по HTTP застосунок працює без мережі завдяки сервісному воркеру `sw.js`, який кешує статичні ресурси.

- **Тільки локальне зберігання даних**  
  Бекенд відсутній.  
  Базова конфігурація читається з `config.json`, а історія звітів, лічильник екіпажу та локальні списки зберігаються лише в `localStorage` браузера.

- **Налаштовувані списки без редагування файлів**  
  Базові списки (дрони, типи місій, боєприпаси, результати, префікси MGRS) задаються в `config.json`.  
  Окремий екран “Налаштування списків” дозволяє перевизначити ці списки локально (разом зі списком стрімів), не змінюючи файл на диску.

- **Навігація між екранами через довге натискання**  
  Довге натискання на заголовок у верхній частині відкриває меню екранів: форма, журнал і статистика, налаштування списків, довідка й контакти.  
  Активний екран у меню підсвічується.

- **Копіювання звіту в буфер обміну**  
  Згенерований текст звіту відображається в полі “Готовий результат” та автоматично копіюється в буфер.  
  За наявності `AndroidBridge` можна реалізувати додаткове ділення/відправлення тексту.

- **Лічильник екіпажу**  
  Числове поле 1–25, яке зберігається між сесіями й може автоматично збільшуватися після кожного сформованого звіту.

- **Підсвітка порожніх важливих полів**  
  Обов’язкові поля підсвічуються (червона рамка та легке світіння), якщо вони порожні, що зменшує кількість помилок при заповненні.

---

## Use cases

- UAV mission reporting in the field  
- Quick notes for sorties and mission results  
- Training and test flight documentation  
- Any situation requiring fast, structured text reports without a backend

---

## Сценарії використання (українською)

- Звітування місій БПЛА в польових умовах  
- Швидкі нотатки по вильотах та їх результатах  
- Документування тренувальних та тестових вильотів  
- Будь-які ситуації, де потрібні швидкі структуровані текстові звіти без сервера

---

## Project structure

```text
Report-UAV/
├── index.html          # Main page; loads js/app.js as ES module
├── styles.css          # Application styles (dark theme, layout, form, screen menu)
├── config.json         # Base lists (drones, mission types, ammo, results, MGRS prefixes) and defaults
├── manifest.json       # PWA manifest (name, icons, display mode, theme colors)
├── sw.js               # Service Worker for offline caching
├── js/
│   ├── app.js          # Entry point: initializes all screens and navigation
│   ├── constants.js    # CONFIG_URL, localStorage keys, REPORTS_LIMIT, STREAM_PLACEHOLDER
│   ├── utils.js        # DOM helper $(), date/time helpers, status text, textarea autosize
│   ├── counter.js      # Crew counter: parse, sanitize, load/save from localStorage
│   ├── coords.js       # Coordinate normalization & MGRS-style string builder
│   ├── clipboard.js    # copyText via Web Clipboard API or AndroidBridge
│   ├── config.js       # loadConfig, applyConfig(+overrides), fillSelect/fillDatalist, empty-field highlighting
│   ├── history.js      # loadReports/addReport: localStorage-backed report history with size limit
│   ├── longPressEdit.js# Long-press on select → free-text input + datalist
│   ├── generate.js     # Build report text, copy, save to history, increment counter, set date, track stream values
│   ├── streams.js      # loadStreams/saveStreams/addStreamValue for known “stream” values
│   ├── navigation.js   # Screen switching and long-press menu on the header
│   └── screens/
│       ├── mainForm.js # Main report form: bindings, config load, long-press edit for selects
│       ├── journal.js  # Journal & statistics screen for a selected period
│       └── settings.js # Local editor screen for lists (drones, ammo, mission types, results, MGRS prefixes, streams)
├── README.md
└── LICENSE             # MIT
```

---

## Screens

- **Main form**  
  Default screen with the mission report form:
  - crew and crew counter;
  - date;
  - drone type;
  - mission type;
  - takeoff time;
  - impact/loss time;
  - MGRS-style coordinates (prefix + easting + northing);
  - ammo;
  - stream;
  - result.  
  Pressing “Done” generates structured report text, copies it to clipboard, saves it to history and optionally increments the crew counter.

- **Journal & statistics**  
  Screen for browsing saved reports and aggregating statistics:
  - filter by date range (“from / to”);
  - refine by impact/loss time range (uses the “impact/loss time” value from the report text);
  - compute:
    - number of sorties,
    - counts per drone,
    - counts per ammo type,
    - counts per mission type,
    - counts per result;
  - display both a textual summary and a readable list of reports in the selected period.

- **Settings (lists)**  
  Screen for editing local lists which override `config.json`:
  - drones;
  - mission types;
  - ammo;
  - results;
  - MGRS prefixes;
  - streams.  
  Each list is edited as “one value per line”. Changes are stored in `localStorage` and applied immediately to the main form. A reset button restores the base `config.json` values.

- **Help & contacts**  
  Short user guide describing:
  - how to fill the main form;
  - how to generate and use the report text;
  - how the journal and statistics screen works;
  - how local list settings behave.  
  This screen also contains a place for developer/maintainer contact information (e.g. email, Telegram, internal contacts).

---

## Екрани (українською)

- **Головна форма**  
  Екран за замовчуванням з формою звіту:
  екіпаж і лічильник, дата, борт, характер місії, час зльоту, час ураження/втрати, координати MGRS, боєприпас, стрім та результат.  
  Кнопка «Готово» формує структурований текст звіту, копіює його в буфер, зберігає в історію та, за потреби, збільшує лічильник екіпажу.

- **Журнал та статистика**  
  Перегляд збережених звітів з фільтрацією за датою та часом завершення місії (поле «Час ураження/втрати»).  
  Екран рахує кількість вильотів і показує зведену статистику за бортами, боєприпасами, типами місій та результатами, а також список звітів у вибраному періоді.

- **Налаштування списків**  
  Редактор локальних списків (дрони, типи місій, боєприпаси, результати, префікси MGRS, стріми), що зберігаються в `localStorage` та мають пріоритет над базовим `config.json`, поки не будуть скинуті.

- **Довідка та контакти**  
  Коротке керівництво користувача та блок для контактів розробника / супроводу застосунку.

---

## Configuration

All selectable options and default values originate from **`config.json`** and optional local overrides.

- `config.json`:
  - `lists` — arrays of strings for dropdowns and datalists (`drones`, `missionTypes`, `ammo`, `results`, `mgrsPrefixes`);
  - `defaults` — initial values for specific fields (`mgrsPrefix`, `missionType`, `result`).
- Local overrides:
  - stored in `localStorage` and applied on top of `config.json`;
  - created and edited via the “Settings” screen;
  - can be reset back to the base config at any time.

Editing `config.json` changes the base profile for all users of the deployed files, while local overrides are per-browser and per-device.

---

## Конфігурація (українською)

- Базові списки та значення за замовчуванням задаються в `config.json` (поля `lists` і `defaults`).  
- Локальні перевизначення зберігаються в `localStorage` та налаштовуються через екран “Налаштування списків”.  
  Вони мають пріоритет над значеннями з файлу `config.json`, поки не будуть скинуті користувачем.

---

## Running locally

- Serve the project over **HTTP** (for example `npx serve .` or any simple static server).  
- Do **not** open `index.html` directly via `file://`:
  - ES modules (`type="module"`) are blocked by most browsers when loaded from the file system.

---

## Запуск локально (українською)

- Запускайте `index.html` через будь-який простий HTTP‑сервер (`npx serve .` тощо).  
- Не відкривайте файл напряму через `file://`, оскільки ES‑модулі зазвичай не працюють у такому режимі.

---

## Privacy

The application **does not** collect, transmit, or store any data on external servers.  
Configuration is loaded from a local file, and all runtime data (reports, counters, settings) live in the browser’s `localStorage` only.

---

## Конфіденційність (українською)

Застосунок **не** збирає, не передає і не зберігає дані на зовнішніх серверах.  
Конфігурація завантажується з локального файлу, а історія звітів, лічильник екіпажу та локальні налаштування зберігаються лише в `localStorage` браузера.

---

## Status

The project is under active development.  
The modular structure (separate screens and JS modules) is stable, and new functionality can be added without breaking the existing workflow.

---

## Статус (українською)

Проєкт знаходиться в активній розробці.  
Модульна структура стабільна, тому функціональність можна розширювати без зміни базових сценаріїв роботи.

---

## License

MIT License — see the [`LICENSE`](LICENSE) file for details.

---

## Ліцензія (українською)

Застосунок поширюється за ліцензією MIT. Деталі містяться у файлі [`LICENSE`](LICENSE).

