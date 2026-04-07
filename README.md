# Report UAV / Звіт БПЛА

**Report UAV** — lightweight single-page web application for creating structured UAV mission reports in the browser.
Designed for fast field reporting from mobile devices. Works offline-first: reports live in **IndexedDB**; optional **Google Sheets** sync via your own **Apps Script** endpoint.

**Звіт БПЛА** — легкий односторінковий веб-додаток для формування структурованих звітів місій БПЛА в браузері.
Розрахований на швидке польове звітування. Працює офлайн-first: звіти в **IndexedDB**; синхронізація з **Google Таблицями** — лише якщо ви налаштували свій **Apps Script Web App**.

---

## Features / Можливості

| Feature | Description |
|---|---|
| **Structured reports** | Each report is an object: `fields` (crew, date, drone, mission type, times, MGRS, ammo, stream, result), generated `text`, `version`, `syncStatus` |
| **IndexedDB storage** | Database `report_uav_db_v2`: stores `reports`, `sync_queue`, `settings`, `sync_log` — single source of truth for the journal |
| **Journal & statistics** | Period filter (from structured date/time), KPI (sorties, hits, losses, efficiency), tabs, search, per-report sync actions |
| **Google Sheets (optional)** | Settings: sheet URL, Apps Script URL, send mode (manual / immediate / delayed), delay minutes, lock after publish; POST JSON to your endpoint |
| **Queue & retries** | Offline or failed sends → queued with backoff retries |
| **Post-publish workflow** | After `sent`, normal edit is blocked; use **correction** flow → `resync_required` → send changes |
| **Interactive map** | MGRS from `report.fields.coords`; grouped markers; same period filter as journal |
| **Encrypted export / import** | Format **v2** — file `uav_reports_v2.enc.json`; AES-256-GCM + PBKDF2; merge by **report `id`** |
| **Result normalization** | Raw result strings mapped to standard categories for statistics |
| **Mobile-first & PWA** | Responsive dark theme, large tap targets, installable |
| **Offline-ready** | Service Worker caches assets after first load |
| **Configurable lists** | Drones, mission types, ammo, results, MGRS prefixes, streams — edited in Settings; overrides in **localStorage** |
| **Crew counter** | 1–25 in localStorage, auto-increment after each report |
| **Long-press navigation** | Long-press header → screen menu |

**Legacy import:** encrypted v1 exports (`kind: uav-reports-export` or same report shapes) are merged on import alongside v2.

---

## Screens / Екрани

### 1. Форма звіту (Main form)

Same fields as before. **«Готово»** validates, builds a **Report**, saves to IndexedDB, shows/copies text, updates crew counter and form date. Send behaviour depends on **sync settings** (manual / immediate / delayed).

### 2. Журнал та статистика (Journal & statistics)

- Filter by mission **date** + **impact time** (structured fields).
- KPI and **Statistics** tab aggregate from **`report.fields`**.
- **Journal** tab: cards with full report text, status dot, icon actions (copy, share, send, edit, etc.).
- **Send list to sheet**: queues **all visible reports** (except **scheduled**) for Google Sheets POST — including **sent** (re-upsert after an emptied sheet).

### 3. Дані та інтеграція (Data & integration)

- **Google Sheets / Apps Script** settings (IndexedDB), test connection, save/reset.
- **Encrypted** export/import (v2 file; v1 legacy payloads accepted when decrypted).
- **Delete all reports** (local archive only) — dangerous action grouped here with backup.

### 4. Карта місій (Map)

Markers from **`fields.coords`** for reports in the selected period. Leaflet; base layer switcher; fullscreen control.

### 5. Налаштування списків (Settings)

- **Lists editor** (tabs, drag-and-drop) — stored in `localStorage` with priority over `config.json`.

### 6. Довідка та контакти (Help)

In-app manual and contacts.

---

## Instructions / Інструкція

### Як створити звіт

1. Заповніть форму (утримання на select → вільний ввід; «Зараз» для часу).
2. **«Готово»** — звіт зберігається локально в IndexedDB.

### Журнал і статистика

Меню → **Журнал та статистика**. Період, пошук, «Показати», вкладки Статистика / Журнал. **Відправити список у таблицю** — у чергу йдуть усі відфільтровані звіти, крім відкладених (scheduled); у тому числі вже **надіслані** (повторний запис у таблицю за `report_id`, якщо лист було очищено). Дії на картці залежать від статусу.

### Карта

Меню → **Карта**. Ті самі умови періоду, що й у журналі.

### Дані, експорт / імпорт

Меню → **Дані та інтеграція**. Файл **`uav_reports_v2.enc.json`**; злиття за **id**. Підтримується також зашифрований експорт **v1** зі старого застосунку. Повне очищення локального архіву — тільки там же (з підтвердженням).

### Google Sheets

1. **Дані та інтеграція** → блок **Google Sheets**.
2. URL таблиці (довідково) та **URL веб-додатку Apps Script**.
3. Режим відправки, затримку, опції блокування.
4. **Перевірити з’єднання** / **Зберегти**.

Готовий приклад **doPost**, який записує **один звіт = один рядок** з заголовками в першому рядку: [`docs/apps-script/README.md`](docs/apps-script/README.md) та [`docs/apps-script/Code.gs`](docs/apps-script/Code.gs).

### Списки форми

Меню → **Налаштування списків** → вкладки → 💾.

### Перевірка HTML (для розробки)

```bash
npm run verify
```

Переконує, що `index.html` містить `js/app.js` і коректно закривається — зменшує ризик зламаного деплою.

### Навігація

Довге натискання на заголовок **«Звіт по БПЛА»** → меню екранів.

---

## Project structure / Структура проєкту

```text
Report-UAV/
├── index.html
├── styles.css
├── config.json
├── manifest.json
├── sw.js
├── LICENSE
├── README.md
│
└── js/
    ├── app.js                 # Entry: openDatabase, sync service, screens
    ├── db.js                  # IndexedDB: report_uav_db_v2
    ├── constants.js           # Limits, keys (e.g. STORAGE_KEY_DEVICE_ID)
    ├── utils.js
    ├── counter.js             # Crew counter (localStorage)
    ├── coords.js
    ├── clipboard.js
    ├── config.js              # config.json + list overrides (localStorage)
    ├── filters.js             # Period filter; impact time from fields
    ├── result-mapping.js
    ├── longPressEdit.js
    ├── generate.js            # Form → createAndStoreReport
    ├── streams.js
    ├── navigation.js
    ├── report-model.js        # Report entity, ids, status helpers
    ├── report-format.js       # fields ↔ text, date/time helpers
    ├── reports-store.js       # CRUD reports
    ├── settings-store.js      # key/value in IDB
    ├── sync-settings.js       # Google Sheets integration defaults I/O
    ├── sync-queue-store.js
    ├── sync-service.js        # Queue, retries, scheduled sends
    ├── google-sheets-api.js   # POST to Apps Script
    ├── report-actions.js      # Facade for UI (list, create, send, edit, import)
    │
    ├── crypto/
    │   ├── crypto.js
    │   └── importExport.js    # Encrypted v2 export/import
    │
    └── screens/
        ├── mainForm.js
        ├── journal.js
        ├── map.js
        └── settings.js        # Lists + integration UI
```

---

## Configuration / Конфігурація

- **`config.json`** — base lists and defaults.
- **List overrides** — `localStorage`, Settings screen.
- **Sync integration** — IndexedDB `settings` (via `sync-settings.js` + `settings-store.js`).

---

## Running locally / Запуск

```bash
npx serve .
```

Do **not** open `index.html` via `file://` — ES modules require HTTP.

---

## Privacy & security / Конфіденційність та безпека

- No developer backend or telemetry in app code.
- Reports and sync metadata: **IndexedDB** on device.
- Crew counter and form list overrides: **localStorage**.
- **Google Sheets:** data is sent only to the **Apps Script URL you configure**.
- Export: **AES-256-GCM**, **PBKDF2** (SHA-256, 250 000 iterations); passphrase never stored.

---

## Документація для ШІ (Cursor, Claude, …)

Один файл без дублювання глибоких гайдів: **[`docs/AI-CONTEXT.md`](docs/AI-CONTEXT.md)** — архітектура, модулі, контракти, типові помилки. Решта деталей у цьому README та в `docs/`.

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

**Report UAV** — field-tested, offline-first.

`IndexedDB` · `AES-256-GCM` · `PBKDF2` · `MGRS` · `Leaflet` · `PWA` · `Apps Script`

</div>
