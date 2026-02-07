const CONFIG_URL = "./config.json";
const STORAGE_KEY_COUNTER = "uav_report_counter_v13";
const STREAM_PLACEHOLDER = "---";
const STORAGE_KEY_REPORTS = "uav_report_history_v1";
const REPORTS_LIMIT = 500;

// --- НОВОЕ: overrides для списков (экран 3) ---
const STORAGE_KEY_LISTS_OVERRIDE = "uav_lists_override_v1";

const $ = (id) => document.getElementById(id);

// --- coords UX state ---
let eastingEditStarted = false;

// --- НОВОЕ: базовый конфиг из config.json (без overrides) ---
let baseConfig = null;

/* ---------------- utils ---------------- */
function pad2(n){ return String(n).padStart(2, "0"); }
function nowTime(){
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function isoToDDMMYYYY(iso){
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function setStatus(msg){
  const el = $("status");
  if (el) el.textContent = msg || "";
}
function autosizeTextarea(el){
  if (!el) return;
  el.style.height = "auto";
  el.style.height = (el.scrollHeight + 2) + "px";
}

/* ---------------- counter ---------------- */
function parseCounterRaw(raw){
  const s = String(raw ?? "").trim();
  if (s === "") return { ok: true, empty: true, value: null };
  if (!/^\d+$/.test(s)) return { ok: false };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 25) return { ok: false };
  return { ok: true, empty: false, value: n };
}
function saveCounterMaybe(valOrNull){
  if (valOrNull === null) localStorage.removeItem(STORAGE_KEY_COUNTER);
  else localStorage.setItem(STORAGE_KEY_COUNTER, String(valOrNull));
}
function loadCounter(){
  const raw = localStorage.getItem(STORAGE_KEY_COUNTER);
  const el = $("crewCounter");
  if (!el) return;
  if (raw === null) { el.value = ""; return; }
  const parsed = parseCounterRaw(raw);
  el.value = (parsed.ok && !parsed.empty) ? String(parsed.value) : "";
}
function sanitizeCounterField(){
  const el = $("crewCounter");
  const err = $("counterError");
  if (!el) return;
  el.value = el.value.replace(/[^\d]/g, "").slice(0,2);
  const parsed = parseCounterRaw(el.value);
  if (parsed.ok) {
    saveCounterMaybe(parsed.empty ? null : parsed.value);
    if (err) err.textContent = "";
  } else {
    if (err) err.textContent = "Лічильник: 1–25.";
  }
  updateEmptyHighlights();
}

/* ---------------- coords ---------------- */
function normalize5(el){ el.value = el.value.replace(/\D/g, "").slice(0,5); }
function onlyDigits5(s){ return /^\d{5}$/.test(s); }

function buildCoordsOrError(){
  const e = ($("easting")?.value || "").trim();
  const n = ($("northing")?.value || "").trim();
  const err = $("coordError");
  if (err) err.textContent = "";
  if (!onlyDigits5(e) || !onlyDigits5(n)) {
    if (err) err.textContent = "Координати: 2 групи по 5 цифр.";
    setStatus("Помилка в координатах.");
    return null;
  }
  return `${$("mgrsPrefix").value} ${e} ${n}`;
}

/* ---------------- clipboard & Android Bridge ---------------- */
async function copyText(text){
  if (window.AndroidBridge) {
    window.AndroidBridge.copyToClipboard(text);
    if (window.AndroidBridge.shareText) window.AndroidBridge.shareText(text);
    return true;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- config & UI ---------------- */
function fillSelect(selectEl, items){
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const name of (items || [])){
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    selectEl.appendChild(opt);
  }
}
function fillDatalist(datalistEl, items){
  if (!datalistEl) return;
  datalistEl.innerHTML = "";
  for (const name of (items || [])){
    const opt = document.createElement("option");
    opt.value = name; datalistEl.appendChild(opt);
  }
}
async function loadConfig(){
  const res = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`config.json error: ${res.status}`);
  return await res.json();
}
function applyConfig(cfg){
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

function updateEmptyHighlights(){
  const ids = ["crew","datePicker","drone","missionType","takeoff","impact","mgrsPrefix","easting","northing","ammo","stream","result"];
  for (const id of ids){
    const el = $(id);
    if (!el) continue;
    if ((el.value ?? "").trim() === "") el.classList.add("is-empty");
    else el.classList.remove("is-empty");
  }
}

/* ---------------- history ---------------- */
function loadReports(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS)) || []; } catch { return []; }
}
function addReport(report){
  const arr = loadReports();
  arr.push(report);
  if (arr.length > REPORTS_LIMIT) arr.shift();
  localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(arr));
}

/* ---------------- long-press edit ---------------- */
function enterEditMode(selectId, datalistId, maxLen){
  const el = $(selectId);
  const input = document.createElement("input");
  input.id = selectId; input.maxLength = maxLen; input.value = el.value;
  input.setAttribute("list", datalistId);
  input.className = el.className;
  el.parentNode.replaceChild(input, el);
  input.focus();
}

function enableLongPressToEdit(selectId, datalistId, maxLen){
  const el = $(selectId);
  let t;
  el.onmousedown = el.ontouchstart = () => { t = setTimeout(() => enterEditMode(selectId, datalistId, maxLen), 600); };
  el.onmouseup = el.onmouseleave = el.ontouchend = () => clearTimeout(t);
}

/* ---------------- lists editor (screen 3) ---------------- */

function listsStatus(msg){
  const el = $("listsStatus");
  if (el) el.textContent = msg || "";
}

function parseLinesToList(text){
  const lines = String(text || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  // убираем дубликаты, сохраняя порядок
  const seen = new Set();
  const out = [];
  for (const x of lines){
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function getListsOverride(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_LISTS_OVERRIDE)) || null;
  } catch {
    return null;
  }
}

function saveListsOverride(overrideObj){
  if (!overrideObj) {
    localStorage.removeItem(STORAGE_KEY_LISTS_OVERRIDE);
    return;
  }
  localStorage.setItem(STORAGE_KEY_LISTS_OVERRIDE, JSON.stringify(overrideObj));
}

function mergeConfigWithOverride(cfg, overrideObj){
  if (!overrideObj?.lists) return cfg;

  const baseLists = cfg?.lists || {};
  const o = overrideObj.lists || {};

  // собираем новый объект, не мутируя cfg
  return {
    ...cfg,
    lists: {
      ...baseLists,
      ...(o.drones ? { drones: o.drones } : {}),
      ...(o.missionTypes ? { missionTypes: o.missionTypes } : {}),
      ...(o.ammo ? { ammo: o.ammo } : {}),
      ...(o.results ? { results: o.results } : {}),
    }
  };
}

function fillListsEditorFromConfig(cfg){
  const lists = cfg?.lists || {};
  const t1 = $("editDrones");
  const t2 = $("editMissionTypes");
  const t3 = $("editAmmo");
  const t4 = $("editResults");

  if (t1) { t1.value = (lists.drones || []).join("\n"); autosizeTextarea(t1); }
  if (t2) { t2.value = (lists.missionTypes || []).join("\n"); autosizeTextarea(t2); }
  if (t3) { t3.value = (lists.ammo || []).join("\n"); autosizeTextarea(t3); }
  if (t4) { t4.value = (lists.results || []).join("\n"); autosizeTextarea(t4); }
}

function initListsEditor(){
  // autosize по мере ввода (минимально, без лишней магии)
  ["editDrones","editMissionTypes","editAmmo","editResults"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => autosizeTextarea(el));
  });

  $("btnListsSave")?.addEventListener("click", () => {
    if (!baseConfig) return;

    const drones = parseLinesToList($("editDrones")?.value);
    const missionTypes = parseLinesToList($("editMissionTypes")?.value);
    const ammo = parseLinesToList($("editAmmo")?.value);
    const results = parseLinesToList($("editResults")?.value);

    const overrideObj = {
      lists: { drones, missionTypes, ammo, results }
    };

    saveListsOverride(overrideObj);

    const merged = mergeConfigWithOverride(baseConfig, overrideObj);
    applyConfig(merged);

    listsStatus("Збережено. Списки оновлено в формі.");
  });

  $("btnListsReset")?.addEventListener("click", () => {
    if (!baseConfig) return;

    saveListsOverride(null);
    applyConfig(baseConfig);
    fillListsEditorFromConfig(baseConfig);

    listsStatus("Скинуто до базового config.json.");
  });
}

/* ---------------- screens (long-press menu) ---------------- */

const SCREENS = [
  { key: "report",  id: "screenReport",  title: "Звіт по БПЛА" },
  { key: "journal", id: "screenJournal", title: "Журнал / Статистика" },
  { key: "lists",   id: "screenLists",   title: "Редагування списків" },
  { key: "spare",   id: "screenSpare",   title: "Запасний екран" }
];

let activeScreenKey = "report";

function setScreen(key){
  const s = SCREENS.find(x => x.key === key) || SCREENS[0];
  activeScreenKey = s.key;

  for (const scr of SCREENS){
    const el = $(scr.id);
    if (!el) continue;
    el.classList.toggle("hidden", scr.key !== s.key);
  }

  renderScreenMenu();
}

function openScreenModal(){
  const modal = $("screenModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  renderScreenMenu();
}

function closeScreenModal(){
  const modal = $("screenModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function renderScreenMenu(){
  const list = $("screenMenuList");
  if (!list) return;
  list.innerHTML = "";

  for (const s of SCREENS){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menuItem" + (s.key === activeScreenKey ? " active" : "");
    btn.textContent = s.title;
    btn.onclick = () => {
      setScreen(s.key);
      closeScreenModal();
    };
    list.appendChild(btn);
  }
}

function bindLongPress(el, onLongPress, ms = 650){
  if (!el) return;

  let timer = null;
  let startX = 0, startY = 0;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const start = (x, y) => {
    startX = x; startY = y;
    clear();
    timer = setTimeout(() => {
      timer = null;
      onLongPress();
    }, ms);
  };

  const move = (x, y) => {
    const dx = Math.abs(x - startX);
    const dy = Math.abs(y - startY);
    if (dx > 10 || dy > 10) clear();
  };

  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });

  el.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });

  el.addEventListener("touchend", clear, { passive: true });
  el.addEventListener("touchcancel", clear, { passive: true });

  el.addEventListener("mousedown", (e) => start(e.clientX, e.clientY));
  el.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
  el.addEventListener("mouseup", clear);
  el.addEventListener("mouseleave", clear);
}

function initScreens(){
  setScreen("report");

  const titles = document.querySelectorAll(".screenTitle");
  titles.forEach(t => bindLongPress(t, openScreenModal, 650));

  $("screenModalClose")?.addEventListener("click", closeScreenModal);
  $("screenModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("modalBackdrop")) closeScreenModal();
  });
}

/* ---------------- generate ---------------- */
async function generate(){
  if ($("crew").value === "") $("crew").value = "Дакар";
  const coords = buildCoordsOrError();
  if (!coords) return;
  
  const parsedCounter = parseCounterRaw($("crewCounter").value);
  const crewLine = parsedCounter.empty ? $("crew").value : `${$("crew").value} (${parsedCounter.value})`;
  
  const text = `${crewLine}\n${isoToDDMMYYYY($("datePicker").value)}\nБорт: ${$("drone").value}\nХарактер: ${$("missionType").value}\nЧас зльоту: ${$("takeoff").value}\nЧас ураження/втрати: ${$("impact").value}\nКоординати: ${coords}\nБоєприпас: ${$("ammo").value}\nСтрім: ${$("stream").value || STREAM_PLACEHOLDER}\nРезультат: ${$("result").value}`;

  $("output").value = text;
  autosizeTextarea($("output"));
  addReport({ ts: new Date().toISOString(), text });

  const ok = await copyText(text);
  setStatus(ok ? "Звіт скопійовано." : "Помилка копіювання.");

  if (!parsedCounter.empty){
    const next = Math.min(25, parsedCounter.value + 1);
    $("crewCounter").value = String(next);
    saveCounterMaybe(next);
  }

  // --- НОВОЕ: после "Готово" ставим дату формы равной системной дате ---
  $("datePicker").value = todayISO();

  updateEmptyHighlights();
}

/* ---------------- init ---------------- */
async function init(){
  $("datePicker").value = todayISO();
  $("takeoff").value = nowTime();
  loadCounter();

  $("btnNowTakeoff").onclick = () => { $("takeoff").value = nowTime(); updateEmptyHighlights(); };
  $("btnNowImpact").onclick = () => { $("impact").value = nowTime(); updateEmptyHighlights(); };
  $("btnGenerate").onclick = generate;

  $("crewCounter").oninput = sanitizeCounterField;

  // --- координаты ---
  $("easting").onfocus = () => { eastingEditStarted = false; };

  $("easting").oninput = () => {
    const eEl = $("easting");
    const nEl = $("northing");

    const before = eEl.value;
    normalize5(eEl);
    const now = eEl.value;

    // ❗ НОВОЕ ПРАВИЛО:
    // если easting стал пустым — northing чистим сразу, без условий
    if (now === "") {
      if (nEl) nEl.value = "";
      eastingEditStarted = false;
      updateEmptyHighlights();
      return;
    }

    // начало нового ввода
    if (!eastingEditStarted && now.length > 0) {
      eastingEditStarted = true;
      if (nEl && nEl.value.trim() !== "") {
        nEl.value = "";
      }
    }

    // автопереход
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
    baseConfig = await loadConfig();
    const merged = mergeConfigWithOverride(baseConfig, getListsOverride());
    applyConfig(merged);
    fillListsEditorFromConfig(merged);
    initListsEditor();
  } catch(e) {
    setStatus("Помилка конфігу.");
  }
  
  enableLongPressToEdit("ammo", "ammoList", 50);
  enableLongPressToEdit("drone", "droneList", 50);
  enableLongPressToEdit("missionType", "missionTypeList", 50);
  enableLongPressToEdit("result", "resultList", 100);

  initScreens();

  updateEmptyHighlights();
}
init();