/**
 * Journal and statistics screen: view reports from localStorage and aggregate by period.
 * Екран журналу та статистики: перегляд звітів з localStorage та агрегація за періодом.
 * @module screens/journal
 */

import { $ } from "../utils.js";
import { loadReports } from "../history.js";

let initialized = false;

/**
 * Initializes the journal/statistics screen once.
 * Ініціалізує екран журналу та статистики (одноразово).
 */
export function initJournalScreen() {
  if (initialized) return;
  initialized = true;

  const btnApply = $("btnJournalApply");
  if (btnApply) {
    btnApply.onclick = () => {
      renderForSelectedPeriod();
    };
  }
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
 * Renders journal list and statistics for the selected date period.
 * Будує список звітів та статистику за обраний період.
 */
function renderForSelectedPeriod() {
  const fromEl = $("journalFrom");
  const toEl = $("journalTo");
  const timeFromEl = $("journalTimeFrom");
  const timeToEl = $("journalTimeTo");
  const summaryEl = $("journalSummary");
  const listEl = $("journalList");

  if (!summaryEl || !listEl) return;

  const fromIso = ((fromEl && fromEl.value) || "").trim();
  const toIso = ((toEl && toEl.value) || "").trim();
  const fromTimeStr = ((timeFromEl && timeFromEl.value) || "").trim();
  const toTimeStr = ((timeToEl && timeToEl.value) || "").trim();

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

  if (filtered.length === 0) {
    summaryEl.textContent = "За обраний період звітів не знайдено.";
    listEl.value = "";
    return;
  }

  const counts = {
    total: filtered.length,
    drones: new Map(),
    ammo: new Map(),
    missionTypes: new Map(),
    results: new Map(),
  };

  const linesForList = [];

  for (const item of filtered) {
    const parsed = parseReportText(item.text);

    const datePart = parsed.date || item.ts.slice(0, 10);
    const header = `${datePart} — ${parsed.crew || ""}`.trim();
    linesForList.push(header);
    linesForList.push(item.text);
    linesForList.push(""); // empty line separator

    if (parsed.drone) inc(counts.drones, parsed.drone);
    if (parsed.ammo) inc(counts.ammo, parsed.ammo);
    if (parsed.missionType) inc(counts.missionTypes, parsed.missionType);
    if (parsed.result) inc(counts.results, parsed.result);
  }

  const parts = [];
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
  listEl.textContent = linesForList.join("\n");
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
 * @param {string} isoDate - "YYYY-MM-DD" or "".
 * @param {string} timeStr - "HH:MM" or "".
 * @param {boolean} isStart - true for start (from), false for end (to).
 * @returns {number} ms or NaN if date is not provided.
 */
function buildBoundaryTimestamp(isoDate, timeStr, isStart) {
  if (!isoDate) return NaN;

  const base = Date.parse(isoDate);
  if (Number.isNaN(base)) return NaN;

  if (!timeStr) {
    if (isStart) {
      return base;
    }
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

