const CONFIG_URL = "./config.json";
const STORAGE_KEY_COUNTER = "uav_report_counter_v13";
const STREAM_PLACEHOLDER = "---";
const STORAGE_KEY_REPORTS = "uav_report_history_v1";
const REPORTS_LIMIT = 200;

const $ = (id) => document.getElementById(id);

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
  // Нативный мост для Android App
  if (window.AndroidBridge) {
    window.AndroidBridge.copyToClipboard(text);
    if (window.AndroidBridge.shareText) window.AndroidBridge.shareText(text);
    return true;
  }
  // Обычный браузер
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
  $("easting").oninput = () => { normalize5($("easting")); if($("easting").value.length===5) $("northing").focus(); updateEmptyHighlights(); };
  $("northing").oninput = () => { normalize5($("northing")); updateEmptyHighlights(); };
  
  try { applyConfig(await loadConfig()); } catch(e) { setStatus("Помилка конфігу."); }
  
  enableLongPressToEdit("ammo", "ammoList", 40);
  enableLongPressToEdit("drone", "droneList", 40);
  enableLongPressToEdit("missionType", "missionTypeList", 40);
  enableLongPressToEdit("result", "resultList", 40);
  updateEmptyHighlights();
}
init();
