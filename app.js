const CONFIG_URL = "./config.json";
const STORAGE_KEY_COUNTER = "uav_report_counter_v13";
const STREAM_PLACEHOLDER = "---";
const STORAGE_KEY_REPORTS = "uav_report_history_v1";
const REPORTS_LIMIT = 200;

// ✅ Local config override for user-added items
// Храним только доп. элементы, а не весь config.json, чтобы не превратить жизнь в ад.
const STORAGE_KEY_CONFIG_OVERRIDE = "uav_config_override_v1";

const $ = (id) => document.getElementById(id);

// --- coords UX state ---
let eastingEditStarted = false;

// --- config state ---
let baseConfig = null;
let effectiveConfig = null;

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
function setListStatus(msg){
  const el = $("listStatus");
  if (el) el.textContent = msg || "";
}
function autosizeTextarea(el){
  if (!el) return;
  el.style.height = "auto";
  el.style.height = (el.scrollHeight + 2) + "px";
}
function normText(s){
  return String(s ?? "").trim().replace(/\s+/g, " ");
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

/* ---------------- local override: add items ---------------- */
/*
  override format:
  {
    "lists": {
      "ammo": ["...", "..."],
      "missionTypes": ["..."],
      ...
    }
  }
*/
function loadOverride(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_OVERRIDE);
    if (!raw) return { lists: {} };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return { lists: {} };
    if (!obj.lists || typeof obj.lists !== "object") obj.lists = {};
    return obj;
  } catch {
    return { lists: {} };
  }
}
function saveOverride(ov){
  localStorage.setItem(STORAGE_KEY_CONFIG_OVERRIDE, JSON.stringify(ov));
}
function clearOverride(){
  localStorage.removeItem(STORAGE_KEY_CONFIG_OVERRIDE);
}

function deepClone(obj){
  try { if (typeof structuredClone === "function") return structuredClone(obj); } catch {}
  return JSON.parse(JSON.stringify(obj ?? {}));
}

function mergeListsUnique(baseArr, extraArr){
  const out = [];
  const seen = new Set();
  for (const v of (baseArr || [])){
    const s = normText(v);
    if (!s) continue;
    if (!seen.has(s)) { seen.add(s); out.push(v); }
  }
  for (const v of (extraArr || [])){
    const s = normText(v);
    if (!s) continue;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

function buildEffectiveConfig(baseCfg, override){
  const merged = deepClone(baseCfg);
  merged.lists = merged.lists || {};
  const ovLists = (override && override.lists) ? override.lists : {};

  // поддерживаем только те списки, которые реально есть в интерфейсе
  const keys = ["ammo","missionTypes","drones","results","mgrsPrefixes"];
  for (const k of keys){
    merged.lists[k] = mergeListsUnique(merged.lists[k] || [], Array.isArray(ovLists[k]) ? ovLists[k] : []);
  }
  return merged;
}

async function reloadAndApplyConfig(){
  if (!baseConfig) baseConfig = await loadConfig();
  const ov = loadOverride();
  effectiveConfig = buildEffectiveConfig(baseConfig, ov);
  applyConfig(effectiveConfig);
}

function listKeyToLabel(key){
  switch (key){
    case "ammo": return "Боєприпас";
    case "missionTypes": return "Характер";
    case "drones": return "Борт";
    case "results": return "Результат";
    case "mgrsPrefixes": return "MGRS префікс";
    default: return key;
  }
}

async function addItemToList(listKey, value){
  const v = normText(value);
  if (!v) {
    setListStatus("Порожнє значення. Таке навіть компілятор не любить.");
    return;
  }

  if (!baseConfig) baseConfig = await loadConfig();
  const ov = loadOverride();
  if (!ov.lists) ov.lists = {};
  if (!Array.isArray(ov.lists[listKey])) ov.lists[listKey] = [];

  // проверка дубликатов относительно effective config (база + оверрайд)
  const currentArr = (effectiveConfig?.lists?.[listKey]) || (baseConfig?.lists?.[listKey]) || [];
  const exists = currentArr.some(x => normText(x) === v);
  if (exists) {
    setListStatus(`Вже є в списку: "${v}". Ніякої драми, просто дубль.`);
    return;
  }

  ov.lists[listKey].push(v);
  saveOverride(ov);

  await reloadAndApplyConfig();

  // UX: выбираем добавленный элемент в соответствующем селекте
  const mapSelectId = {
    ammo: "ammo",
    missionTypes: "missionType",
    drones: "drone",
    results: "result",
    mgrsPrefixes: "mgrsPrefix"
  };
  const selId = mapSelectId[listKey];
  const sel = selId ? $(selId) : null;
  if (sel) sel.value = v;

  setListStatus(`Додано в "${listKeyToLabel(listKey)}": "${v}".`);
}

async function resetUserChanges(){
  clearOverride();
  // перечитать базу заново, чтобы гарантированно убрать всё
  baseConfig = await loadConfig();
  effectiveConfig = buildEffectiveConfig(baseConfig, { lists: {} });
  applyConfig(effectiveConfig);
  setListStatus("Локальні доповнення скинуто. Все знову як у “ванілі”.");
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
      if (nEl && nEl.value.trim() !== "") nEl.value = "";
    }

    if (now.length === 5 && nEl) nEl.focus();
    updateEmptyHighlights();
  };

  $("northing").oninput = () => {
    const nEl = $("northing");
    normalize5(nEl);
    if ((nEl.value || "").length === 5) nEl.blur();
    updateEmptyHighlights();
  };

  // ✅ Load config + apply override
  try {
    baseConfig = await loadConfig();
    await reloadAndApplyConfig();
  } catch(e) {
    setStatus("Помилка конфігу.");
  }

  enableLongPressToEdit("ammo", "ammoList", 40);
  enableLongPressToEdit("drone", "droneList", 40);
  enableLongPressToEdit("missionType", "missionTypeList", 40);
  enableLongPressToEdit("result", "resultList", 40);

  // ✅ Bind list editor controls (if present)
  const btnAdd = $("btnListAdd");
  const btnReset = $("btnListReset");
  const target = $("listTarget");
  const input = $("listNewValue");

  if (btnAdd && target && input) {
    btnAdd.onclick = async () => {
      setListStatus("");
      await addItemToList(target.value, input.value);
      input.value = "";
      input.focus();
    };
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnAdd.click();
      }
    });
  }

  if (btnReset) {
    btnReset.onclick = async () => {
      setListStatus("");
      await resetUserChanges();
    };
  }

  updateEmptyHighlights();
}
init();