# Report UAV

**Report UAV** is a lightweight web application for creating structured UAV (drone) mission reports directly in the browser. It is designed for fast field reporting, mobile devices, and offline use. All data is stored locally on the user's device and is not sent to any server.

---

**Звіт БПЛА** — легка веб-програма для створення структурованих звітів місій БПЛА прямо в браузері. Призначена для швидкого польового звітування, мобільних пристроїв та роботи офлайн. Усі дані зберігаються локально на пристрої користувача і нікуди не передаються.

---

## Features | Можливості

- **Structured reports** — Create UAV mission reports using a form with crew, date, drone type, mission type, takeoff/impact time, MGRS-style coordinates, ammo, stream, and result.
- **Mobile-first** — Optimized for phones and tablets; works as a PWA (Progressive Web App) with optional offline caching.
- **Offline-ready** — Service Worker caches assets; the app works without a network after first load.
- **Local only** — No backend; configuration and report history live in the browser (localStorage and config.json).
- **Configurable** — Dropdown options and defaults are driven by `config.json`; edit it to match your workflow and terminology.
- **Copy to clipboard** — Generated report is copied automatically; on Android WebView, optional share via `AndroidBridge`.
- **Crew counter** — Optional numeric counter (1–25) per crew, saved between sessions; auto-increments after each report.
- **Empty-field highlight** — Required fields are visually highlighted when empty (red border) to reduce mistakes.

---

- **Структуровані звіти** — Створення звітів місій БПЛА через форму: екіпаж, дата, борт, характер місії, час зльоту/ураження, координати (MGRS), боєприпас, стрім, результат.
- **Під мобільні** — Оптимізація для телефонів та планшетів; можлива робота як PWA з офлайн-кешуванням.
- **Офлайн** — Сервісний воркер кешує ресурси; після першого завантаження додаток працює без мережі.
- **Тільки локально** — Без бекенду; конфіг та історія звітів у браузері (localStorage та config.json).
- **Налаштовується** — Списки та значення за замовчуванням задаються в `config.json`; можна змінювати під свою термінологію.
- **Копіювання** — Згенерований звіт копіюється в буфер; у Android WebView можливий обмін через `AndroidBridge`.
- **Лічильник екіпажу** — Додатковий числовий лічильник (1–25) для екіпажу, зберігається між сесіями; автоматично збільшується після кожного звіту.
- **Підсвітка порожніх полів** — Обов’язкові поля підсвічуються (червона рамка), якщо порожні.

---

## Use cases | Сценарії використання

- UAV mission reporting in the field  
  *Звітування місій БПЛА в полі*
- Quick notes for drone sorties and results  
  *Швидкі нотатки по вильотах та результатах*
- Training and test flight documentation  
  *Документування тренувальних та тестових вильотів*
- Any situation requiring fast, structured text reports without a server  
  *Будь-які ситуації, де потрібні швидкі структуровані текстові звіти без сервера*

---

## Project structure | Структура проекту

```
Report-UAV/
├── index.html          # Main page; loads js/app.js as ES module
├── styles.css          # Application styles (dark theme, layout, form)
├── config.json         # Lists (drones, mission types, ammo, results, MGRS prefixes) and defaults
├── manifest.json       # PWA manifest (name, icons, display, theme)
├── sw.js               # Service Worker for offline caching
├── js/
│   ├── app.js          # Entry point: init, event bindings, config load
│   ├── constants.js    # CONFIG_URL, storage keys, REPORTS_LIMIT, STREAM_PLACEHOLDER
│   ├── utils.js        # DOM helper $(), date/time (nowTime, todayISO, isoToDDMMYYYY), setStatus, autosizeTextarea
│   ├── counter.js      # Crew counter: parse, save/load, sanitize
│   ├── coords.js       # Easting/northing normalize & buildCoordsOrError
│   ├── clipboard.js   # copyText (Web API or AndroidBridge)
│   ├── config.js       # loadConfig, applyConfig, fillSelect/fillDatalist, updateEmptyHighlights
│   ├── history.js      # loadReports, addReport (localStorage, size-limited)
│   ├── longPressEdit.js # Long-press select → input+datalist for free text
│   └── generate.js     # Build report text, copy, save to history, increment counter, set date
├── README.md
└── LICENSE              # MIT
```

---

## Configuration | Конфігурація

All selectable options and default values come from **`config.json`**.

**Structure:**

- **`lists`** — Arrays of strings for dropdowns and datalists:
  - `drones`, `missionTypes`, `ammo`, `results`, `mgrsPrefixes`
- **`defaults`** — Initial values for specific fields:
  - `mgrsPrefix`, `missionType`, `result`

Edit `config.json` to add/remove options or change defaults. No code changes required.

---

Усі варіанти вибору та значення за замовчуванням задаються в **`config.json`**.

**Структура:**

- **`lists`** — Масиви рядків для списків: `drones`, `missionTypes`, `ammo`, `results`, `mgrsPrefixes`.
- **`defaults`** — Початкові значення для полів: `mgrsPrefix`, `missionType`, `result`.

Змінюйте `config.json` для додавання/видалення пунктів або зміни за замовчуванням. Зміни коду не потрібні.

---

## Running locally | Запуск локально

- Open `index.html` over **HTTP** (e.g. `npx serve .` or any static server). ES modules do not load from `file://` in most browsers.
- Відкривайте `index.html` по **HTTP** (наприклад `npx serve .` або будь-який статичний сервер). ES-модулі не завантажуються з `file://` у більшості браузерів.

---

## Privacy | Конфіденційність

The application **does not** collect, transmit, or store data on any external server. Configuration is loaded from a local file; report history and crew counter are stored in the browser’s localStorage only.

Додаток **не** збирає, не передає і не зберігає дані на зовнішніх серверах. Конфігурація завантажується з локального файлу; історія звітів та лічильник екіпажу зберігаються лише в localStorage браузера.

---

## Status | Статус

The project is in active development. The modular structure is stable; functionality may be extended (e.g. journal view, statistics, config editor).

Проект у активній розробці. Модульна структура стабільна; функціональність може розширюватися (наприклад, перегляд журналу, статистика, редактор конфігу).

---

## License | Ліцензія

MIT License. See [LICENSE](LICENSE).

Ліцензія MIT. Деталі в [LICENSE](LICENSE).
