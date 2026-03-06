/**
 * Journal and statistics screen: view reports from localStorage and aggregate by period.
 * Екран журналу та статистики: перегляд звітів з localStorage та агрегація за періодом.
 * @module screens/journal
 */

import { $ } from "../utils.js";
import { loadReports } from "../history.js";
import { loadPeriodFilter, savePeriodFilter } from "../filters.js";

let initialized = false;
let lastFilteredReports = [];

/**
 * Initializes KPI tiles.
 * Оновлює KPI-плитки.
 * @param {{ total?: number, hits?: number, loss?: number }} data
 */
function setKpi({ total = 0, hits = 0, loss = 0 }) {
  const totalEl = $("kpiTotal");
  const hitsEl = $("kpiHits");
  const lossEl = $("kpiLoss");
  const rateEl = $("kpiRate");

  if (totalEl) totalEl.textContent = String(total);
  if (hitsEl) hitsEl.textContent = String(hits);
  if (lossEl) lossEl.textContent = String(loss);

  const rate = total > 0 ? Math.round((hits / total) * 100) : 0;
  if (rateEl) rateEl.textContent = `${rate}%`;
}

/**
 * Initializes the journal/statistics screen once.
 * Ініціалізує екран журналу та статистики (одноразово).
 */
export function initJournalScreen() {
  if (initialized) return;
  initialized = true;

  applySharedPeriodToInputs();

  const btnApply = $("btnJournalApply");
  if (btnApply) {
    btnApply.onclick = () => {
      saveCurrentInputsToSharedFilter();
      renderForSelectedPeriod();
    };
  }

  const tabStats = $("tabStats");
  const tabJournal = $("tabJournal");
  const statsSection = $("statsSection");
  const journalSection = $("journalSection");

  if (tabStats && tabJournal && statsSection && journalSection) {
    const setTab = (mode) => {
      const isStats = mode === "stats";
      tabStats.classList.toggle("active", isStats);
      tabJournal.classList.toggle("active", !isStats);
      statsSection.style.display = isStats ? "" : "none";
      journalSection.style.display = isStats ? "none" : "";
    };

    tabStats.addEventListener("click", () => setTab("stats"));
    tabJournal.addEventListener("click", () => setTab("journal"));

    setTab("stats");
  }

  const searchEl = $("journalSearch");
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      renderJournalCards(lastFilteredReports);
    });
  }

  const btnCopySummary = $("btnCopyJournalSummary");
  if (btnCopySummary) {
    btnCopySummary.onclick = async () => {
      const summaryEl = $("journalSummary");
      const text = summaryEl?.textContent || "";
      if (!text.trim()) return;

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Ignore clipboard errors silently.
      }
    };
  }

  const btnCopyAll = $("btnJournalCopyAll");
  if (btnCopyAll) {
    btnCopyAll.onclick = async () => {
      const text = lastFilteredReports.map((r) => r.text || "").join("\n\n");
      if (!text.trim()) return;

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Ignore clipboard errors silently.
      }
    };
  }

  renderForSelectedPeriod();
}

/**
 * Loads shared period filter and applies it to journal inputs.
 * Завантажує спільний фільтр періоду та підставляє його в поля журналу.
 */
function applySharedPeriodToInputs() {
  const period = loadPeriodFilter();

  const fromEl = $("journalFrom");
  const toEl = $("journalTo");
  const fromTimeEl = $("journalTimeFrom");
  const toTimeEl = $("journalTimeTo");

  if (fromEl) fromEl.value = period.fromDate;
  if (toEl) toEl.value = period.toDate;
  if (fromTimeEl) fromTimeEl.value = period.fromTime;
  if (toTimeEl) toTimeEl.value = period.toTime;
}

/**
 * Saves current input values to shared filter storage.
 * Зберігає поточні значення полів у спільний фільтр.
 */
function saveCurrentInputsToSharedFilter() {
  savePeriodFilter({
    fromDate: $("journalFrom")?.value || "",
    toDate: $("journalTo")?.value || "",
    fromTime: $("journalTimeFrom")?.value || "",
    toTime: $("journalTimeTo")?.value || "",
  });
}

/**
 * Parses structured fields from generated report text.
 * Розбирає структуровані поля з тексту звіту.
 * @param {string} text
 * @returns {{crew?: string, date?: string, drone?: string, missionType?: string, ammo?: string, stream?: string, result?: string, impactTime?: string, coords?: string}}
 */
function parseReportText(text) {
  const lines = String(text || "").split("\n");
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
      case "Координати":
        out.coords = value;
        break;
      default:
        break;
    }
  }

  return out;
}

/**
 * Renders journal statistics and cards for selected period.
 * Будує статистику та картки журналу за обраний період.
 */
function renderForSelectedPeriod() {
  const summaryEl = $("journalSummary");
  const barsEl = $("barsContainer");

  if (!summaryEl || !barsEl) return;

  const fromIso = ($("journalFrom")?.value || "").trim();
  const toIso = ($("journalTo")?.value || "").trim();
  const fromTimeStr = ($("journalTimeFrom")?.value || "").trim();
  const toTimeStr = ($("journalTimeTo")?.value || "").trim();

  const fromMs = buildBoundaryTimestamp(fromIso, fromTimeStr, true);
  const toMs = buildBoundaryTimestamp(toIso, toTimeStr, false);

  const reports = loadReports();

  const filtered = reports.filter((r) => {
    const parsed = parseReportText(r.text);
    const impactMs = buildImpactTimestamp(parsed, r.ts);
    if (impactMs == null) return false;

    if (!Number.isNaN(fromMs) && impactMs < fromMs) return false;
    if (!Number.isNaN(toMs) && impactMs > toMs) return false;

    return true;
  });

  lastFilteredReports = filtered;

  if (filtered.length === 0) {
    setKpi({ total: 0, hits: 0, loss: 0 });
    summaryEl.textContent = "За обраний період звітів не знайдено.";
    barsEl.innerHTML = "";
    renderJournalCards([]);
    return;
  }

  const counts = {
    total: filtered.length,
    hits: 0,
    loss: 0,
    drones: new Map(),
    ammo: new Map(),
    missionTypes: new Map(),
    results: new Map(),
  };

  for (const item of filtered) {
    const parsed = parseReportText(item.text);
    const result = parsed.result || "";

    if (parsed.drone) inc(counts.drones, parsed.drone);
    if (parsed.ammo) inc(counts.ammo, parsed.ammo);
    if (parsed.missionType) inc(counts.missionTypes, parsed.missionType);
    if (parsed.result) inc(counts.results, parsed.result);

    if (isHitResult(result)) counts.hits += 1;
    if (isLossResult(result)) counts.loss += 1;
  }

  setKpi({
    total: counts.total,
    hits: counts.hits,
    loss: counts.loss,
  });

  renderSummary(summaryEl, counts);
  renderBars(barsEl, counts);
  renderJournalCards(filtered);
}

/**
 * Checks whether result means successful hit.
 * Перевіряє, чи результат означає ураження.
 * @param {string} result
 * @returns {boolean}
 */
function isHitResult(result) {
  const s = String(result || "").toLowerCase();
  return s.includes("ураж") || s.includes("знищ");
}

/**
 * Checks whether result means loss.
 * Перевіряє, чи результат означає втрату.
 * @param {string} result
 * @returns {boolean}
 */
function isLossResult(result) {
  const s = String(result || "").toLowerCase();
  return s.includes("втра");
}

/**
 * Renders summary text block.
 * Будує текстовий summary-блок.
 * @param {HTMLElement} summaryEl
 * @param {object} counts
 */
function renderSummary(summaryEl, counts) {
  const parts = [];
  parts.push(`Кількість вильотів: ${counts.total}`);
  parts.push(`Уражень: ${counts.hits}`);
  parts.push(`Втрат: ${counts.loss}`);

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
}

/**
 * Renders lightweight statistics blocks.
 * Малює легкі статистичні блоки.
 * @param {HTMLElement} root
 * @param {object} counts
 */
function renderBars(root, counts) {
  root.innerHTML = "";

  renderMapBlock(root, "Борти", counts.drones);
  renderMapBlock(root, "Боєприпаси", counts.ammo);
  renderMapBlock(root, "Типи місій", counts.missionTypes);
  renderMapBlock(root, "Результати", counts.results);
}

/**
 * Renders one statistics block from map.
 * Малює один статистичний блок із Map.
 * @param {HTMLElement} root
 * @param {string} title
 * @param {Map<string, number>} map
 */
function renderMapBlock(root, title, map) {
  if (!map.size) return;

  const wrap = document.createElement("div");
  wrap.className = "journal-summary";

  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "700";
  titleEl.style.marginBottom = "6px";
  titleEl.textContent = title;

  const bodyEl = document.createElement("div");
  bodyEl.textContent = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}: ${count}`)
    .join("\n");

  wrap.appendChild(titleEl);
  wrap.appendChild(bodyEl);
  root.appendChild(wrap);
}

/**
 * Renders journal cards using current search query.
 * Малює картки журналу з урахуванням поточного пошуку.
 * @param {Array<{text:string, ts:string}>} reports
 */
function renderJournalCards(reports) {
  const cardsEl = $("journalCards");
  const searchEl = $("journalSearch");

  if (!cardsEl) return;

  const query = String(searchEl?.value || "").trim().toLowerCase();

  const filteredBySearch = reports.filter((item) => {
    if (!query) return true;
    return String(item.text || "").toLowerCase().includes(query);
  });

  cardsEl.innerHTML = "";

  if (!filteredBySearch.length) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "journal-summary";
    emptyEl.textContent = "Немає звітів для відображення.";
    cardsEl.appendChild(emptyEl);
    return;
  }

  for (const item of filteredBySearch) {
    const parsed = parseReportText(item.text);

    const card = document.createElement("div");
    card.className = "journal-card";

    const head = document.createElement("div");
    head.className = "journal-card-head";

    const title = document.createElement("div");
    title.className = "journal-card-title";
    title.textContent = `${parsed.date || item.ts?.slice(0, 10) || ""} • ${parsed.crew || "Без екіпажу"}`;

    const actions = document.createElement("div");
    actions.className = "journal-card-actions";

    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.className = "btn btnSmall";
    btnCopy.textContent = "Копіювати";
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(item.text || "");
      } catch {
        // ignore
      }
    };

    actions.appendChild(btnCopy);
    head.appendChild(title);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "journal-card-body";
    body.textContent = item.text || "";

    card.appendChild(head);
    card.appendChild(body);
    cardsEl.appendChild(card);
  }
}

/**
 * Helper to increment value in Map.
 * Допоміжна функція для інкременту значення в Map.
 * @param {Map<string, number>} map
 * @param {string} key
 */
function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * Builds timestamp (ms) from report's date and impact time, or falls back to stored ts.
 * Повертає мітку часу (мс) з дати звіту та часу ураження, або з ts, якщо дані відсутні.
 * @param {{date?: string, impactTime?: string}} parsed
 * @param {string} fallbackTs
 * @returns {number|null}
 */
function buildImpactTimestamp(parsed, fallbackTs) {
  if (parsed && parsed.date && parsed.impactTime) {
    const dateParts = parsed.date.split(".");
    const timeParts = parsed.impactTime.split(":");

    if (dateParts.length === 3 && timeParts.length >= 2) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);

      const d = new Date(year, month - 1, day, hour, minute || 0, 0, 0);
      const ms = d.getTime();
      if (!Number.isNaN(ms)) return ms;
    }
  }

  const fb = Date.parse(fallbackTs);
  if (Number.isNaN(fb)) return null;
  return fb;
}

/**
 * Builds boundary timestamp from date+time inputs.
 * Повертає мітку часу межі з полів дати/часу.
 * @param {string} isoDate
 * @param {string} timeStr
 * @param {boolean} isStart
 * @returns {number}
 */
function buildBoundaryTimestamp(isoDate, timeStr, isStart) {
  if (!isoDate) return NaN;

  const base = Date.parse(isoDate);
  if (Number.isNaN(base)) return NaN;

  if (!timeStr) {
    if (isStart) return base;
    return base + 24 * 60 * 60 * 1000 - 1;
  }

  const parts = timeStr.split(":");
  if (parts.length < 2) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }

  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  const d = new Date(base);
  d.setHours(hour || 0, minute || 0, isStart ? 0 : 59, isStart ? 0 : 999);

  const ms = d.getTime();
  if (Number.isNaN(ms)) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }

  return ms;
}
