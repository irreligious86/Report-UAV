# Контекст для нейромереж і асистентів (Cursor, Claude тощо)

**Єдина точка входу для ШІ:** короткий опис архітектури та правил, без дублювання детальних інструкцій. Глибина — у файлах, на які є посилання.

## Обов’язкові посилання

| Файл | Зміст |
|------|--------|
| [README.md](../README.md) | Можливості, екрани, інструкція користувача, структура репо |
| [docs/apps-script/README.md](./apps-script/README.md) | Розгортання Apps Script, поля payload, `Code.gs` |
| [docs/google-sheets-sync-decomposition.md](./google-sheets-sync-decomposition.md) | Розкладка синхронізації з таблицею (якщо потрібні деталі) |
| [docs/google-sheets-sync-tz.md](./google-sheets-sync-tz.md) | Технічне завдання / етапи sync |

Не створюйте нові загальні README поруч, якщо достатньо оновити цей файл або `README.md`.

---

## Як має працювати застосунок (логіка)

1. **Офлайн-first:** джерело істини для звітів — **IndexedDB** (`report_uav_db_v2`: `reports`, `sync_queue`, `settings`, `sync_log`).
2. **Звіт** — об’єкт з `id`, `fields` (camelCase: `crew`, `crewCounter`, `date`, `missionType`, `takeoff`, `impact`, `coords`, …), похідного `text`, `syncStatus`, `version`, тощо. Див. `js/report-model.js`, `js/report-format.js`.
3. **Форма «Готово»:** `js/generate.js` → `createAndStoreReport` у `js/report-actions.js` (черга sync залежить від режиму відправки в налаштуваннях).
4. **Журнал і статистика:** один рендер `renderForSelectedPeriod()` у `js/screens/journal.js` — KPI, текстове зведення, картки. Фільтр періоду: `js/filters.js` (`getImpactTimestampForReport` використовує `fields.date` + `fields.impact`, інакше fallback на `createdAt`).
5. **Карта:** `js/screens/map.js` — ті самі відфільтровані звіти за період; точки з `fields.coords` (MGRS).
6. **Google Sheets:** клієнт лише **POST JSON** на URL веб-додатку; парсинг і запис у клітинки — **Code.gs**. Транспорт: `js/google-sheets-api.js`, черга: `js/sync-service.js`.
7. **Події оновлення UI:** `reportsUpdated` (і за потреби `reportsChanged`) — журнал підписаний і перемальовується.

---

## Ключові модулі (шляхи)

| Шлях | Роль |
|------|------|
| `js/app.js` | Ініціалізація БД, sync, екранів, навігації |
| `js/navigation.js` | Екрани, скидання full-screen мапи/журналу |
| `js/report-actions.js` | Фасад: створення, черга, `trySendReportNow`, масова відправка |
| `js/sync-service.js` | `processSyncQueue`, retry, `enqueueSendReport` |
| `js/reports-store.js` | CRUD IndexedDB |
| `js/screens/journal.js` | Журнал: **має містити** `appendActionIcons` поруч з рендером карток; без неї — помилка в циклі й картки/KPI не оновлюються |
| `js/screens/map.js` | Leaflet, маркери |
| `js/screens/data.js` | Імпорт/експорт, налаштування Sheets |
| `docs/apps-script/Code.gs` | Сервер: `ping`, `prepare_sheet`, `upsert_report` |

---

## Правила змін для асистентів

- Не ламати **контракт полів** між `report-format.js`, IndexedDB і `Code.gs` (див. [apps-script/README](./apps-script/README.md)).
- Після змін у кешованих асетах піднімати версію в `sw.js` (`CACHE_NAME`).
- Тіло відповіді веб-додатку для upsert/ping/prepare має бути **валідний JSON з `ok: true`** при успіху — див. `js/google-sheets-api.js`.
- Редагування звіту в журналі: поля в діалозі мають `data-field-key` — збір у `collectFieldsFromEditDialog` повинен шукати саме цей атрибут.

---

## Типова причина «дані є в БД, карта OK, журнал порожній»

Помилка JavaScript **під час побудови картки** (наприклад, виклик неіснуючої функції, на кшталт видаленої `appendActionIcons`) — лічильник «Відібрано» уже оновлений, а цикл обривається до `updateKPI` і додавання карток.

---

## Мова інтерфейсу

Основна мова UI: **українська**. Документація для людей може бути EN/UK змішана (як у кореневому README).
