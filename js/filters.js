/**
 * Shared period filter state for journal/statistics and map screens.
 * Спільний фільтр періоду для журналу/статистики та мапи.
 * @module filters
 */

const STORAGE_KEY_PERIOD_FILTER = "uav_period_filter_v1";

/**
 * Returns today's date in local YYYY-MM-DD format.
 * Повертає сьогоднішню дату у локальному форматі YYYY-MM-DD.
 * @returns {string}
 */
function getTodayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns default shared period filter.
 * Повертає фільтр періоду за замовчуванням.
 * @returns {{fromDate:string,toDate:string,fromTime:string,toTime:string}}
 */
export function getDefaultPeriodFilter() {
  const today = getTodayLocalDate();
  return {
    fromDate: today,
    toDate: today,
    fromTime: "00:00",
    toTime: "23:59",
  };
}

/**
 * Loads shared period filter from localStorage.
 * Завантажує спільний фільтр періоду з localStorage.
 * @returns {{fromDate:string,toDate:string,fromTime:string,toTime:string}}
 */
export function loadPeriodFilter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERIOD_FILTER);
    if (!raw) return getDefaultPeriodFilter();

    const parsed = JSON.parse(raw);
    const def = getDefaultPeriodFilter();

    return {
      fromDate: parsed?.fromDate || def.fromDate,
      toDate: parsed?.toDate || def.toDate,
      fromTime: parsed?.fromTime || def.fromTime,
      toTime: parsed?.toTime || def.toTime,
    };
  } catch {
    return getDefaultPeriodFilter();
  }
}

/**
 * Saves shared period filter to localStorage.
 * Зберігає спільний фільтр періоду в localStorage.
 * @param {{fromDate:string,toDate:string,fromTime:string,toTime:string}} filter
 */
export function savePeriodFilter(filter) {
  const def = getDefaultPeriodFilter();

  const normalized = {
    fromDate: filter?.fromDate || def.fromDate,
    toDate: filter?.toDate || def.toDate,
    fromTime: filter?.fromTime || def.fromTime,
    toTime: filter?.toTime || def.toTime,
  };

  localStorage.setItem(STORAGE_KEY_PERIOD_FILTER, JSON.stringify(normalized));
}

/**
 * Converts date + time into local Date object.
 * Конвертує дату + час у локальний об'єкт Date.
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date|null}
 */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const safeTime = timeStr || "00:00";
  const dt = new Date(`${dateStr}T${safeTime}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Checks if timestamp is inside shared filter range.
 * Перевіряє, чи входить timestamp у діапазон фільтра.
 * @param {number|Date|string} value
 * @param {{fromDate:string,toDate:string,fromTime:string,toTime:string}} filter
 * @returns {boolean}
 */
export function isWithinPeriodFilter(value, filter) {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return false;

  const from = combineDateTime(filter?.fromDate, filter?.fromTime || "00:00");
  const to = combineDateTime(filter?.toDate, filter?.toTime || "23:59");

  if (!from || !to) return true;

  return dt >= from && dt <= to;
}