# Архів: технічний план «Спринт 1» (IndexedDB + фасад history.js)

**Статус:** документ **не описує поточний код**. Це збережений орієнтир попередньої ітерації планування (міграція з `localStorage`, фасад `history.js`, `reportsDb.js`, поле `ts` у сущності тощо).

**Актуальна архітектура:** [google-sheets-sync-decomposition.md](./google-sheets-sync-decomposition.md) та корінь [README.md](../README.md).

---

## Що фактично зроблено в репозиторії (замість цього плану)

| Планувалось (орієнтир) | У коді зараз |
|------------------------|--------------|
| БД на кшталт `uav_report_db`, міграція з LS | БД **`report_uav_db_v2`** (`js/db.js`), **без** вбудованої міграції legacy-звітів |
| Фасад `history.js` | Видалено; екрани працюють через **`report-actions.js`** та stores |
| `reportEntity.js` | Замінено на **`report-model.js`** + **`report-format.js`** |
| Один store `reports` на першому кроці | Stores: **`reports`**, **`sync_queue`**, **`settings`**, **`sync_log`** |
| `normalizeReport()` з `ts` | Сущність **`Report`** без окремого `ts`; часи — `createdAt` / `updatedAt` / `publishedAt` |

Якщо потрібен перенесений старий архів тексту попередньої версії цього файлу — див. історію комітів у git.
