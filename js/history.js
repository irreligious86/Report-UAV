/**
 * Report history: load/save array of reports in localStorage with size limit.
 * История отчётов: загрузка/сохранение массива отчётов в localStorage с ограничением размера.
 * @module history
 */

import { STORAGE_KEY_REPORTS, REPORTS_LIMIT } from "./constants.js";

/**
 * Loads report history from localStorage. Returns empty array on parse error.
 * Загружает историю отчётов из localStorage. При ошибке разбора возвращает пустой массив.
 * @returns {Array<{ ts: string, text: string }>} Array of reports. Массив отчётов.
 */
export function loadReports() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS)) || [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Saves full reports array to localStorage and trims it to REPORTS_LIMIT.
 * Зберігає весь масив звітів у localStorage з обмеженням REPORTS_LIMIT.
 * @param {Array<{ ts: string, text: string }>} reports
 */
export function saveReports(reports) {
  const arr = Array.isArray(reports) ? reports : [];
  const trimmed = arr.slice(-REPORTS_LIMIT);
  localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(trimmed));
}

/**
 * Appends a report to history, keeps only last REPORTS_LIMIT entries.
 * Додає звіт в історію, зберігає лише останні REPORTS_LIMIT записів.
 * @param {{ ts: string, text: string }} report - Report object (timestamp, text). Об'єкт звіту (час, текст).
 */
export function addReport(report) {
  const arr = loadReports();
  arr.push(report);
  saveReports(arr);
}
