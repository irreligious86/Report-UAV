/**
 * Journal and statistics screen: view reports from localStorage and aggregate by period.
 * Екран журналу та статистики: перегляд звітів з localStorage та агрегація за періодом.
 * @module screens/journal
 */

import { $, isoToDDMMYYYY } from "../utils.js";
import {
  loadReports,
  deleteAllReports,
  deleteReportsByIds,
  updateReportText,
} from "../history.js";
import { REPORTS_LIMIT, STORAGE_KEY_REPORTS } from "../constants.js";
import {
  loadPeriodFilter,
  savePeriodFilter,
  isWithinPeriodFilter,
  getImpactTimestampForReport,
  normalizeDateToISO,
} from "../filters.js";
import {
  mapResultToCategory,
  RESULT_CATEGORIES,
  isKpiHit,
  isKpiLoss,
} from "../result-mapping.js";
import {
  exportEncryptedReports,
  importEncryptedReports,
} from "../crypto/importExport.js";

let initialized = false;

/** @type {string|null} */
let editingReportId = null;

/**
 * Same filtering as the journal list (period + search).
 * @param {Array<{ id: string, ts: string, text: string }>} reports
 * @param {{fromDate:string,toDate:string,fromTime:string,toTime:string}} period
 * @param {string} searchStr
 */
function filterReportsForJournal(reports, period, searchStr) {
  const q = (searchStr || "").trim().toLowerCase();
  return reports.filter((r) => {
    const impactMs = getImpactTimestampForReport(r);
    if (impactMs == null) return false;
    if (!isWithinPeriodFilter(impactMs, period)) return false;
    if (q) {
      const hay = (r.text || "").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Initializes the journal/statistics screen once.
 * Ініціалізує екран журналу та статистики (одноразово).
 */
export function initJournalScreen() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("reportsUpdated", () => {
    renderForSelectedPeriod();
  });

  // Sync shared period filter into inputs on first load.
  applySharedFilterToInputs();

  // Apply
  const btnApply = $("btnJournalApply");
  if (btnApply) {
    btnApply.onclick = () => {
      saveCurrentInputsToSharedFilter();
      renderForSelectedPeriod();
    };
  }

  // Copy summary
  const btnCopy = $("btnCopyJournalSummary");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const summaryEl = $("journalSummary");
      const text = (summaryEl?.textContent || "").trim();
      if (!text) return;
      await copyTextSmart(text);
    };
  }

  // Tabs
  const tabStats = $("tabStats");
  const tabJournal = $("tabJournal");
  const statsSection = $("statsSection");
  const journalSection = $("journalSection");

  const setTab = (name) => {
    const isStats = name === "stats";

    if (tabStats) tabStats.classList.toggle("active", isStats);
    if (tabJournal) tabJournal.classList.toggle("active", !isStats);

    if (statsSection) statsSection.style.display = isStats ? "" : "none";
    if (journalSection) journalSection.style.display = isStats ? "none" : "";
  };

  if (tabStats) tabStats.onclick = () => setTab("stats");
  if (tabJournal) tabJournal.onclick = () => setTab("journal");
  setTab("stats");

  // Search (debounced)
  const searchEl = $("journalSearch");
  if (searchEl) {
    let t = null;
    searchEl.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => renderForSelectedPeriod(), 200);
    };
  }

  // First render
  renderForSelectedPeriod();

  // Encrypted export/import
  const btnExport = $("btnExportEncrypted");
  if (btnExport) {
    btnExport.onclick = async () => {
      await handleExportEncrypted();
    };
  }

  const btnImport = $("btnImportEncrypted");
  const importInput = $("importEncryptedFile");
  if (btnImport && importInput instanceof HTMLInputElement) {
    btnImport.onclick = () => {
      importInput.value = "";
      importInput.click();
    };

    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      await handleImportEncrypted(file);
      importInput.value = "";
    });
  }

  const btnDelFiltered = $("btnJournalDeleteFiltered");
  if (btnDelFiltered) {
    btnDelFiltered.onclick = () => {
      const period = loadPeriodFilter();
      const searchStr = (($("journalSearch")?.value) || "").trim();
      const reports = loadReports();
      const filtered = filterReportsForJournal(reports, period, searchStr);
      if (filtered.length === 0) {
        window.alert(
          "Немає що видаляти: за цим періодом і пошуком список порожній. Спробуйте змінити умови або переконайтеся, що в архіві є звіти."
        );
        return;
      }
      const ok = window.confirm(
        `Видалити ${filtered.length} звіт(ів) зі списку нижче (те саме, що зараз показує період і пошук)? Інші збережені звіти залишаться. Це незворотно.`
      );
      if (!ok) return;
      deleteReportsByIds(filtered.map((r) => r.id));
      renderForSelectedPeriod();
    };
  }

  const btnDelAll = $("btnJournalDeleteAll");
  if (btnDelAll) {
    btnDelAll.onclick = () => {
      const n = loadReports().length;
      if (n === 0) {
        window.alert("Архів уже порожній.");
        return;
      }
      const ok = window.confirm(
        `Видалити всі ${n} звіт(ів) у архіві цього браузера? Записи не можна буде відновити.`
      );
      if (!ok) return;
      deleteAllReports();
      renderForSelectedPeriod();
    };
  }

  setupEditDialog();
}

/**
 * Applies shared period filter into journal inputs.
 * Підставляє спільний фільтр періоду у поля журналу.
 */
function applySharedFilterToInputs() {
  const period = loadPeriodFilter();

  const fromEl = $("journalFrom");
  const toEl = $("journalTo");
  const timeFromEl = $("journalTimeFrom");
  const timeToEl = $("journalTimeTo");

  if (fromEl) fromEl.value = period.fromDate || "";
  if (toEl) toEl.value = period.toDate || "";
  if (timeFromEl) timeFromEl.value = period.fromTime || "";
  if (timeToEl) timeToEl.value = period.toTime || "";
}

/**
 * Reads current journal inputs and saves them into shared period filter.
 * Зчитує значення полів журналу та зберігає у спільний фільтр.
 */
function saveCurrentInputsToSharedFilter() {
  const payload = {
    fromDate: ($("journalFrom")?.value || "").trim(),
    toDate: ($("journalTo")?.value || "").trim(),
    fromTime: ($("journalTimeFrom")?.value || "").trim(),
    toTime: ($("journalTimeTo")?.value || "").trim(),
  };

  savePeriodFilter(payload);
}

/**
 * Parses structured fields from generated report text.
 * Розбирає структуровані поля з тексту звіту.
 * @param {string} text - Report text as saved in history.
 * @returns {{crew?: string, date?: string, drone?: string, missionType?: string, ammo?: string, stream?: string, result?: string, impactTime?: string}}
 */
function parseReportText(text) {
  const lines = (text || "").split("\n");
  const out = {};

  if (lines[0]) out.crew = lines[0].trim();
  if (lines[1]) out.date = lines[1].trim();

  for (const line of lines.slice(2)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    switch (key) {
      case "Борт":
        out.drone = value;
        break;
      case "Характер":
        out.missionType = value;
        break;
      case "Боєприпас":
        out.ammo = value;
        break;
      case "Стрім":
        out.stream = value;
        break;
      case "Час ураження/втрати":
        out.impactTime = value;
        break;
      case "Результат":
        out.result = value;
        break;
      default:
        break;
    }
  }

  return out;
}

/**
 * Renders journal cards and statistics for the selected period.
 * Будує журнал (картками) та статистику за обраний період.
 */
function renderForSelectedPeriod() {
  const period = loadPeriodFilter();
  const fromIso = period.fromDate || "";
  const toIso = period.toDate || "";
  const fromTimeStr = period.fromTime || "";
  const toTimeStr = period.toTime || "";

  const summaryEl = $("journalSummary");
  const cardsEl = $("journalCards"); // NEW container
  const archiveEl = $("journalArchiveInfo");
  if (!summaryEl || !cardsEl) return;

  const searchRaw = (($("journalSearch")?.value) || "").trim();

  const reports = loadReports();

  if (archiveEl) {
    archiveEl.textContent =
      `Архів на цьому пристрої: ${reports.length} з ${REPORTS_LIMIT} збережених звітів (localStorage цього браузера, ключ ${STORAGE_KEY_REPORTS}). Статистика та журнал показують лише звіти, що відповідають періоду й пошуку.`;
  }

  const filtered = filterReportsForJournal(reports, period, searchRaw);

  const filterCountEl = $("journalFilterCount");
  if (filterCountEl) {
    filterCountEl.textContent = `Відібрано звітів: ${filtered.length} із ${reports.length} у архіві (період, час завершення та пошук).`;
  }

  // Newest first (by mission end time)
  filtered.sort((a, b) => {
    const ta = getImpactTimestampForReport(a) ?? 0;
    const tb = getImpactTimestampForReport(b) ?? 0;
    return tb - ta;
  });

  // Always clear cards
  cardsEl.textContent = "";

  if (filtered.length === 0) {
    summaryEl.textContent = "За обраний період звітів не знайдено.";
    updateKPI(0, 0, 0);
    return;
  }

  const counts = {
    total: filtered.length,
    drones: new Map(),
    ammo: new Map(),
    missionTypes: new Map(),
    results: new Map(),
  };

  // KPI: count normalized hits vs losses
  let hits = 0;
  let loss = 0;

  const allTexts = [];

  // Render cards
  for (const item of filtered) {
    const parsed = parseReportText(item.text);

    const dateIso =
      normalizeDateToISO(parsed.date || "") ||
      String(item.ts || "").slice(0, 10) ||
      "";

    const dateHuman =
      (parsed.date && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(String(parsed.date).trim())
        ? String(parsed.date).trim()
        : "") ||
      isoToDDMMYYYY(dateIso) ||
      dateIso;

    const crewLabel = (parsed.crew || "").trim() || "Звіт";
    const cardSummary = dateHuman ? `${crewLabel} · ${dateHuman}` : crewLabel;

    allTexts.push(item.text);

    // Count maps
    if (parsed.drone) inc(counts.drones, parsed.drone);
    if (parsed.ammo) inc(counts.ammo, parsed.ammo);
    if (parsed.missionType) inc(counts.missionTypes, parsed.missionType);
    if (parsed.result) {
      const category = mapResultToCategory(parsed.result);
      inc(counts.results, category);

      if (isKpiHit(parsed.result)) hits += 1;
      if (isKpiLoss(parsed.result)) loss += 1;
    }

    // Card DOM
    const card = document.createElement("div");
    card.className = "journal-card";

    const head = document.createElement("div");
    head.className = "journal-card-head";

    const summary = document.createElement("div");
    summary.className = "journal-card-summary";
    summary.textContent = cardSummary;

    const actions = document.createElement("div");
    actions.className = "journal-card-actions";

    const btnCopyOne = document.createElement("button");
    btnCopyOne.type = "button";
    btnCopyOne.className = "btnSmall";
    btnCopyOne.textContent = "Копіювати";
    btnCopyOne.onclick = () => copyTextSmart(item.text);

    const btnShare = document.createElement("button");
    btnShare.type = "button";
    btnShare.className = "btnSmall";
    btnShare.textContent = "Поділитися";
    btnShare.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ text: item.text });
        } catch {
          // user canceled or unsupported
        }
      } else {
        await copyTextSmart(item.text);
      }
    };

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btnSmall";
    btnEdit.textContent = "Змінити";
    btnEdit.onclick = () => openEditDialog(item.id, item.text);

    actions.appendChild(btnCopyOne);
    actions.appendChild(btnShare);
    actions.appendChild(btnEdit);

    head.appendChild(summary);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "journal-card-body";
    body.textContent = item.text;

    card.appendChild(head);
    card.appendChild(body);

    cardsEl.appendChild(card);
  }

  // Copy all
  const btnCopyAll = $("btnJournalCopyAll");
  if (btnCopyAll) {
    btnCopyAll.onclick = () => copyTextSmart(allTexts.join("\n\n---\n\n"));
  }

  // Summary text (as before)
  const parts = [];
  const fmtPeriod = (d, t) => (d ? (t ? `${d} ${t}` : d) : "");
  parts.push(`Період: ${fmtPeriod(fromIso, fromTimeStr)} → ${fmtPeriod(toIso, toTimeStr)}`);
  parts.push("");
  parts.push(`Кількість вильотів: ${counts.total}`);

  const block = (label, map) => {
    if (!map.size) return;
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n");
    parts.push(`${label}:\n${entries}`);
  };

  block("Бортів", counts.drones);
  block("Боєприпасів", counts.ammo);
  block("Типів місій", counts.missionTypes);
  block("Результатів", counts.results);

  summaryEl.textContent = parts.join("\n\n");

  // KPI
  updateKPI(counts.total, hits, loss);
}

/**
 * Sets transfer status message for export/import operations.
 * @param {string} message
 * @param {boolean} isError
 */
function setTransferStatus(message, isError = false) {
  const el = $("journalTransferStatus");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "var(--danger)" : "";
}

/**
 * Prompts user for encryption key.
 * @param {string} title
 * @returns {string|null}
 */
function promptForKey(title) {
  const value = window.prompt(title, "");
  if (value == null) return null;
  const key = value.trim();
  if (!key) {
    throw new Error("Ключ шифрування порожній.");
  }
  return key;
}

/**
 * Converts unknown error into readable message.
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Сталася невідома помилка.";
}

/**
 * Handles encrypted reports export.
 * Uses a double-entry prompt for key confirmation.
 * @returns {Promise<void>}
 */
async function handleExportEncrypted() {
  try {
    setTransferStatus("Підготовка експорту...");

    const key1 = promptForKey("Введи ключ шифрування для експорту");
    if (key1 == null) {
      setTransferStatus("Експорт скасовано.");
      return;
    }

    const key2 = promptForKey("Повтори ключ шифрування");
    if (key2 == null) {
      setTransferStatus("Експорт скасовано.");
      return;
    }

    if (key1 !== key2) {
      throw new Error("Ключі не співпадають.");
    }

    const result = await exportEncryptedReports(key1);
    setTransferStatus(
      `Експорт завершено. Файл: ${result.fileName}. Записів: ${result.count}.`
    );
  } catch (error) {
    setTransferStatus(getErrorMessage(error), true);
  }
}

/**
 * Handles encrypted reports import from selected file and merges into history.
 * @param {File} file
 * @returns {Promise<void>}
 */
async function handleImportEncrypted(file) {
  try {
    setTransferStatus(`Імпорт файлу "${file.name}"...`);

    const key = promptForKey("Введи ключ для розшифрування файлу");
    if (key == null) {
      setTransferStatus("Імпорт скасовано.");
      return;
    }

    const result = await importEncryptedReports(file, key);

    setTransferStatus(
      `Імпорт завершено. Було: ${result.before}, у файлі: ${result.imported}, додано: ${result.added}, стало: ${result.after}.`
    );

    // Refresh view with updated reports
    renderForSelectedPeriod();
  } catch (error) {
    setTransferStatus(getErrorMessage(error), true);
  }
}

/**
 * Helper to increment value in Map.
 * @param {Map<string, number>} map
 * @param {string} key
 */
function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * KPI render
 */
function updateKPI(total, hits, loss) {
  const kTotal = $("kpiTotal");
  const kHits = $("kpiHits");
  const kLoss = $("kpiLoss");
  const kRate = $("kpiRate");

  if (kTotal) kTotal.textContent = String(total);
  if (kHits) kHits.textContent = String(hits);
  if (kLoss) kLoss.textContent = String(loss);

  const rate = total ? Math.round((hits / total) * 100) : 0;
  if (kRate) kRate.textContent = `${rate}%`;
}

/**
 * @param {string} id
 * @param {string} text
 */
function openEditDialog(id, text) {
  const dialog = $("journalEditDialog");
  const ta = $("journalEditTextarea");
  if (!(dialog instanceof HTMLDialogElement) || !(ta instanceof HTMLTextAreaElement)) {
    return;
  }
  editingReportId = id;
  ta.value = text || "";
  dialog.showModal();
  ta.focus();
}

function setupEditDialog() {
  const dialog = $("journalEditDialog");
  const ta = $("journalEditTextarea");
  const btnCancel = $("journalEditCancel");
  const btnSave = $("journalEditSave");

  const closeDialog = () => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  };

  if (dialog instanceof HTMLDialogElement) {
    dialog.addEventListener("close", () => {
      editingReportId = null;
    });
  }

  if (btnCancel) {
    btnCancel.onclick = () => closeDialog();
  }

  if (btnSave && ta instanceof HTMLTextAreaElement) {
    btnSave.onclick = () => {
      if (!editingReportId) {
        closeDialog();
        return;
      }
      const body = ta.value;
      if (!body.trim()) {
        window.alert("Текст звіту не може бути порожнім.");
        return;
      }
      const id = editingReportId;
      const ok = updateReportText(id, { text: body });
      if (!ok) {
        window.alert("Не вдалося зберегти: запис не знайдено.");
      }
      closeDialog();
      renderForSelectedPeriod();
    };
  }
}

/**
 * Copies text to clipboard with fallback.
 * @param {string} text
 */
async function copyTextSmart(text) {
  const t = (text || "").trim();
  if (!t) return;

  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}