/**
 * Long-press to edit: replace <select> with <input list="..."> after 600ms hold for free-text input.
 * Долгое нажатие для редактирования: замена <select> на <input list="..."> после удержания 600 мс для свободного ввода.
 * @module longPressEdit
 */

import { $ } from "./utils.js";

/**
 * Replaces the select element with an input that has the same id, list attribute, maxLength, value and class; focuses it.
 * Заменяет элемент select на input с тем же id, атрибутом list, maxLength, значением и классом; фокусирует его.
 * @param {string} selectId - ID of the select. ID элемента select.
 * @param {string} datalistId - ID of the datalist for the new input. ID datalist для нового input.
 * @param {number} maxLen - Max length of the input. Максимальная длина ввода.
 */
export function enterEditMode(selectId, datalistId, maxLen) {
  const el = $(selectId);
  const input = document.createElement("input");
  input.id = selectId;
  input.maxLength = maxLen;
  input.value = el.value;
  input.setAttribute("list", datalistId);
  input.className = el.className;
  el.parentNode.replaceChild(input, el);
  input.focus();
}

/**
 * Enables long-press (600ms) on a select to switch to edit mode (input + datalist).
 * Включает долгое нажатие (600 мс) по select для перехода в режим редактирования (input + datalist).
 * @param {string} selectId - ID of the select. ID элемента select.
 * @param {string} datalistId - ID of the datalist. ID элемента datalist.
 * @param {number} maxLen - Max length for the replacement input. Максимальная длина для заменяющего input.
 */
export function enableLongPressToEdit(selectId, datalistId, maxLen) {
  const el = $(selectId);
  let t;
  el.onmousedown = el.ontouchstart = () => {
    t = setTimeout(() => enterEditMode(selectId, datalistId, maxLen), 600);
  };
  el.onmouseup = el.onmouseleave = el.ontouchend = () => clearTimeout(t);
}
