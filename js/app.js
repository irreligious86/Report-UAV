/**
 * Application entry: initialization, event bindings (date, time, coordinates, buttons), config load, long-press edit.
 * Точка входа приложения: инициализация, привязка событий (дата, время, координаты, кнопки), загрузка конфига, долгое нажатие.
 * @module app
 */

import { $, todayISO, nowTime, setStatus } from "./utils.js";
import { loadCounter, sanitizeCounterField } from "./counter.js";
import { normalize5 } from "./coords.js";
import { loadConfig, applyConfig, updateEmptyHighlights } from "./config.js";
import { enableLongPressToEdit } from "./longPressEdit.js";
import { generate } from "./generate.js";

/** Tracks whether user has started typing in easting (to clear northing on new entry). */
/** Отслеживает, начал ли пользователь ввод в easting (для очистки northing при новом вводе). */
let eastingEditStarted = false;

/**
 * Initializes the app: sets default date/time, loads counter, binds all form and coordinate handlers, loads config, enables long-press edit.
 * Инициализирует приложение: дата/время по умолчанию, загрузка счётчика, привязка обработчиков формы и координат, загрузка конфига, долгое нажатие.
 * @returns {Promise<void>}
 */
async function init() {
  $("datePicker").value = todayISO();
  $("takeoff").value = nowTime();
  loadCounter();

  $("btnNowTakeoff").onclick = () => {
    $("takeoff").value = nowTime();
    updateEmptyHighlights();
  };
  $("btnNowImpact").onclick = () => {
    $("impact").value = nowTime();
    updateEmptyHighlights();
  };
  $("btnGenerate").onclick = generate;

  $("crewCounter").oninput = sanitizeCounterField;

  $("easting").onfocus = () => {
    eastingEditStarted = false;
  };

  $("easting").oninput = () => {
    const eEl = $("easting");
    const nEl = $("northing");

    normalize5(eEl);
    const now = eEl.value;

    if (now === "") {
      if (nEl) nEl.value = "";
      eastingEditStarted = false;
      updateEmptyHighlights();
      return;
    }

    if (!eastingEditStarted && now.length > 0) {
      eastingEditStarted = true;
      if (nEl && nEl.value.trim() !== "") {
        nEl.value = "";
      }
    }

    if (now.length === 5 && nEl) nEl.focus();

    updateEmptyHighlights();
  };

  $("northing").oninput = () => {
    const nEl = $("northing");
    normalize5(nEl);

    if ((nEl.value || "").length === 5) {
      nEl.blur();
    }

    updateEmptyHighlights();
  };

  try {
    applyConfig(await loadConfig());
  } catch (e) {
    setStatus("Помилка конфігу.");
  }

  enableLongPressToEdit("ammo", "ammoList", 50);
  enableLongPressToEdit("drone", "droneList", 50);
  enableLongPressToEdit("missionType", "missionTypeList", 50);
  enableLongPressToEdit("result", "resultList", 100);

  updateEmptyHighlights();
}

init();
