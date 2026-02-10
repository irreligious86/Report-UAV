/**
 * Report generation: build text from form, copy to clipboard, save to history, increment counter, update date.
 * Формирование отчёта: сбор текста из формы, копирование в буфер, сохранение в историю, инкремент счётчика, обновление даты.
 * @module generate
 */

import { $, isoToDDMMYYYY, todayISO, autosizeTextarea, setStatus } from "./utils.js";
import { STREAM_PLACEHOLDER } from "./constants.js";
import { parseCounterRaw, saveCounterMaybe } from "./counter.js";
import { buildCoordsOrError } from "./coords.js";
import { addReport } from "./history.js";
import { copyText } from "./clipboard.js";
import { updateEmptyHighlights } from "./config.js";
import { addStreamValue } from "./streams.js";

/**
 * Generates the report text from form fields, writes to #output, copies to clipboard, saves to history.
 * If crew counter is set, increments it and updates date picker to today.
 * Формирует текст отчёта из полей формы, записывает в #output, копирует в буфер, сохраняет в историю.
 * Если задан счётчик экипажа — увеличивает его и обновляет дату на сегодня.
 * @returns {Promise<void>}
 */
export async function generate() {
  if ($("crew").value === "") $("crew").value = "Дакар";
  const coords = buildCoordsOrError();
  if (!coords) return;

  const parsedCounter = parseCounterRaw($("crewCounter").value);
  const crewLine = parsedCounter.empty ? $("crew").value : `${$("crew").value} (${parsedCounter.value})`;

  const text = `${crewLine}\n${isoToDDMMYYYY($("datePicker").value)}\nБорт: ${$("drone").value}\nХарактер: ${$("missionType").value}\nЧас зльоту: ${$("takeoff").value}\nЧас ураження/втрати: ${$("impact").value}\nКоординати: ${coords}\nБоєприпас: ${$("ammo").value}\nСтрім: ${$("stream").value || STREAM_PLACEHOLDER}\nРезультат: ${$("result").value}`;

  $("output").value = text;
  autosizeTextarea($("output"));
  addReport({ ts: new Date().toISOString(), text });

  // Remember stream value for settings screen list (auto-populate if new).
  addStreamValue($("stream").value || "");

  const ok = await copyText(text);
  setStatus(ok ? "Звіт скопійовано." : "Помилка копіювання.");

  if (!parsedCounter.empty) {
    const next = Math.min(25, parsedCounter.value + 1);
    $("crewCounter").value = String(next);
    saveCounterMaybe(next);
  }

  $("datePicker").value = todayISO();
  updateEmptyHighlights();
}
