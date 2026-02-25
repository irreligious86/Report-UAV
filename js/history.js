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
    return JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS)) || [];
  } catch {
    return [];
  }
}

/**
 * Appends a report to history, keeps only last REPORTS_LIMIT entries.
 * Добавляет отчёт в историю, хранит только последние REPORTS_LIMIT записей.
 * @param {{ ts: string, text: string }} report - Report object (timestamp, text). Объект отчёта (время, текст).
 */
export function addReport(report) {
  const arr = loadReports();
  arr.push(report);
  if (arr.length > REPORTS_LIMIT) arr.shift();
  localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(arr));
}
