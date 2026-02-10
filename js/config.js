/**
 * Configuration loading and UI: fill selects/datalists from config.json, apply defaults, empty-field highlights.
 * Загрузка конфигурации и UI: заполнение select/datalist из config.json, применение значений по умолчанию, подсветка пустых полей.
 * @module config
 */

import { $ } from "./utils.js";
import { CONFIG_URL } from "./constants.js";

/**
 * Fills a <select> with options from an array of strings.
 * Заполняет <select> вариантами из массива строк.
 * @param {HTMLSelectElement | null} selectEl - Select element. Элемент select.
 * @param {string[]} items - Option labels and values. Элементы списка.
 */
export function fillSelect(selectEl, items) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const name of (items || [])) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }
}

/**
 * Fills a <datalist> with options (for autocomplete on inputs).
 * Заполняет <datalist> вариантами (для автодополнения в полях ввода).
 * @param {HTMLDataListElement | null} datalistEl - Datalist element. Элемент datalist.
 * @param {string[]} items - Option values. Значения вариантов.
 */
export function fillDatalist(datalistEl, items) {
  if (!datalistEl) return;
  datalistEl.innerHTML = "";
  for (const name of (items || [])) {
    const opt = document.createElement("option");
    opt.value = name;
    datalistEl.appendChild(opt);
  }
}

/**
 * Fetches and parses config.json (no cache).
 * Загружает и разбирает config.json (без кеша).
 * @returns {Promise<object>} Config object. Объект конфигурации.
 * @throws {Error} On fetch failure. При ошибке загрузки.
 */
export async function loadConfig() {
  const res = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`config.json error: ${res.status}`);
  return await res.json();
}

/**
 * Applies config: fills all selects/datalists from cfg.lists, sets cfg.defaults, then updates empty highlights.
 * Применяет конфиг: заполняет select/datalist из cfg.lists, выставляет cfg.defaults, обновляет подсветку пустых полей.
 * @param {object} cfg - Config object (lists, defaults). Объект конфигурации (lists, defaults).
 */
export function applyConfig(cfg) {
  const lists = cfg?.lists || {};
  fillSelect($("drone"), lists.drones || []);
  fillSelect($("missionType"), lists.missionTypes || []);
  fillSelect($("ammo"), lists.ammo || []);
  fillSelect($("result"), lists.results || []);
  fillSelect($("mgrsPrefix"), lists.mgrsPrefixes || []);

  fillDatalist($("droneList"), lists.drones || []);
  fillDatalist($("missionTypeList"), lists.missionTypes || []);
  fillDatalist($("ammoList"), lists.ammo || []);
  fillDatalist($("resultList"), lists.results || []);

  if (cfg?.defaults?.mgrsPrefix) $("mgrsPrefix").value = cfg.defaults.mgrsPrefix;
  if (cfg?.defaults?.missionType) $("missionType").value = cfg.defaults.missionType;
  if (cfg?.defaults?.result) $("result").value = cfg.defaults.result;
  updateEmptyHighlights();
}

/** IDs of form fields that get the "is-empty" class when their value is blank. */
/** ID полей формы, получающих класс "is-empty" при пустом значении. */
const EMPTY_HIGHLIGHT_IDS = ["crew", "datePicker", "drone", "missionType", "takeoff", "impact", "mgrsPrefix", "easting", "northing", "ammo", "stream", "result"];

/**
 * Toggles "is-empty" class on configured fields based on whether their value is blank.
 * Переключает класс "is-empty" у заданных полей в зависимости от того, пусто ли значение.
 */
export function updateEmptyHighlights() {
  for (const id of EMPTY_HIGHLIGHT_IDS) {
    const el = $(id);
    if (!el) continue;
    if ((el.value ?? "").trim() === "") el.classList.add("is-empty");
    else el.classList.remove("is-empty");
  }
}
