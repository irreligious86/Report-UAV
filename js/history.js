/**
 * Report history: load/save array of reports in localStorage with size limit.
 * История отчётов: загрузка/сохранение массива отчётов в localStorage с ограничением размера.
 * @module history
 */

import { STORAGE_KEY_REPORTS, REPORTS_LIMIT } from "./constants.js";

/**
 * @returns {string}
 */
export function newReportId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Loads report history from localStorage. Returns empty array on parse error.
 * Assigns missing `id` to legacy entries and persists once if migration ran.
 * Загружает историю отчётов из localStorage. При ошибке разбора возвращает пустой массив.
 * @returns {Array<{ id: string, ts: string, text: string }>} Array of reports. Массив отчётов.
 */
export function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    const value = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];

    let changed = false;
    const normalized = [];

    for (const item of value) {
      if (!item || typeof item !== "object") {
        changed = true;
        continue;
      }
      if (typeof item.ts !== "string" || typeof item.text !== "string") {
        changed = true;
        continue;
      }

      let id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : "";
      if (!id) {
        id = newReportId();
        changed = true;
      }

      normalized.push({ id, ts: item.ts, text: item.text });
    }

    if (normalized.length !== value.length) changed = true;

    const trimmed = normalized.slice(-REPORTS_LIMIT);
    const overLimit = normalized.length > REPORTS_LIMIT;

    if (changed || overLimit) {
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(trimmed));
      window.dispatchEvent(new Event("reportsUpdated"));
    }

    return trimmed;
  } catch {
    return [];
  }
}

/**
 * Saves full reports array to localStorage and trims it to REPORTS_LIMIT.
 * Зберігає весь масив звітів у localStorage з обмеженням REPORTS_LIMIT.
 * @param {Array<{ id?: string, ts: string, text: string }>} reports
 */
export function saveReports(reports) {
  const arr = Array.isArray(reports) ? reports : [];
  const withIds = arr.map((r) => {
    if (!r || typeof r !== "object") return null;
    if (typeof r.ts !== "string" || typeof r.text !== "string") return null;
    const id =
      typeof r.id === "string" && r.id.trim() ? r.id.trim() : newReportId();
    return { id, ts: r.ts, text: r.text };
  }).filter(Boolean);

  const trimmed = withIds.slice(-REPORTS_LIMIT);
  localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(trimmed));
  window.dispatchEvent(new Event("reportsUpdated"));
}

/**
 * Appends a report to history, keeps only last REPORTS_LIMIT entries.
 * Додає звіт в історію, зберігає лише останні REPORTS_LIMIT записів.
 * @param {{ id?: string, ts: string, text: string }} report - Report object. Об'єкт звіту.
 */
export function addReport(report) {
  const arr = loadReports();
  const id =
    report.id && String(report.id).trim()
      ? String(report.id).trim()
      : newReportId();
  arr.push({ id, ts: report.ts, text: report.text });
  saveReports(arr);
}

/**
 * Removes every saved report.
 */
export function deleteAllReports() {
  saveReports([]);
}

/**
 * Removes reports whose `id` is in the set.
 * @param {string[]} ids
 */
export function deleteReportsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const drop = new Set(ids.map((x) => String(x)));
  const arr = loadReports().filter((r) => !drop.has(r.id));
  saveReports(arr);
}

/**
 * Updates text of a single report by id.
 * @param {string} id
 * @param {{ text: string }} patch
 * @returns {boolean} True if the report existed and was updated.
 */
export function updateReportText(id, patch) {
  const rid = String(id || "").trim();
  if (!rid) return false;
  const nextText = patch?.text;
  if (typeof nextText !== "string") return false;

  const arr = loadReports();
  const i = arr.findIndex((r) => r.id === rid);
  if (i === -1) return false;

  arr[i] = { ...arr[i], text: nextText };
  saveReports(arr);
  return true;
}
