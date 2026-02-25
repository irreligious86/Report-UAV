/**
 * Journal and statistics screen: view reports from localStorage and aggregate by period.
 * Екран журналу та статистики: перегляд звітів з localStorage та агрегація за періодом.
 * @module screens/journal
 */

import { $ } from "../utils.js";
import { loadReports } from "../history.js";

let initialized = false;

/**
 * Initializes the journal/statistics screen once.
 * Ініціалізує екран журналу та статистики (одноразово).
 */
export function initJournalScreen() {
  if (initialized) return;
  initialized = true;

  // Apply
  const btnApply = $("btnJournalApply");
  if (btnApply) btnApply.onclick = () => renderForSelectedPeriod();

  // Copy summary
  const btnCopy = $("btnCopyJournalSummary");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const summaryEl = $("journalSummary");
      const text = (summaryEl?.textContent || "").trim();
      if (!text) return;
      await copyTextSmart(text);
    };
  }

  // Tabs
  const tabStats = $("tabStats");
  const tabJournal = $("tabJournal");
  const statsSection = $("statsSection");
  const journalSection = $("journalSection");

  const setTab = (name) => {
    const isStats = name === "stats";

    if (tabStats) tabStats.classList.toggle("active", isStats);
    if (tabJournal) tabJournal.classList.toggle("active", !isStats);

    if (statsSection) statsSection.style.display = isStats ? "" : "none";
    if (journalSection) journalSection.style.display = isStats ? "none" : "";
  };

  if (tabStats) tabStats.onclick = () => setTab("stats");
  if (tabJournal) tabJournal.onclick = () => setTab("journal");
  setTab("stats");

  // Search (debounced)
  const searchEl = $("journalSearch");
  if (searchEl) {
    let t = null;
    searchEl.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => renderForSelectedPeriod(), 200);
    };
  }

  // Default period: current month
  applyDefaultPeriodCurrentMonth();

  // First render
  renderForSelectedPeriod();
}

/**
 * Default: first day of current month 00:00, last day of current month 23:59
 */
function applyDefaultPeriodCurrentMonth() {
  const fromEl = $("journalFrom");
  const toEl = $("journalTo");
  const timeFromEl = $("journalTimeFrom");
  const timeToEl = $("journalTimeTo");

  const pad2 = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (fromEl && !fromEl.value) fromEl.value = toISO(first);
  if (toEl && !toEl.value) toEl.value = toISO(last);

  if (timeFromEl && !timeFromEl.value) timeFromEl.value = "00:00";
  if (timeToEl && !timeToEl.value) timeToEl.value = "23:59";
}

/**
 * Parses structured fields from generated report text.
 * Розбирає структуровані поля з тексту звіту.
 * @param {string} text - Report text as saved in history.
 * @returns {{crew?: string, date?: string, drone?: string, missionType?: string, ammo?: string, stream?: string, result?: string, impactTime?: string}}
 */
function parseReportText(text) {
  const lines = (text || "").split("\n");
  const out = {};

  if (lines[0]) out.crew = lines[0].trim();
  if (lines[1]) out.date = lines[1].trim();

  for (const line of lines.slice(2)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    switch (key) {
      case "Борт":
        out.drone = value;
        break;
      case "Характер":
        out.missionType = value;
        break;
      case "Боєприпас":
        out.ammo = value;
        break;
      case "Стрім":
        out.stream = value;
        break;
      case "Час ураження/втрати":
        out.impactTime = value;
        break;
      case "Результат":
        out.result = value;
        break;
      default:
        break;
    }
  }

  return out;
}

/**
 * Renders journal cards and statistics for the selected period.
 * Будує журнал (картками) та статистику за обраний період.
 */
function renderForSelectedPeriod() {
  const fromIso = (($("journalFrom")?.value) || "").trim();
  const toIso = (($("journalTo")?.value) || "").trim();
  const fromTimeStr = (($("journalTimeFrom")?.value) || "").trim();
  const toTimeStr = (($("journalTimeTo")?.value) || "").trim();

  const summaryEl = $("journalSummary");
  const cardsEl = $("journalCards"); // NEW container
  if (!summaryEl || !cardsEl) return;

  const fromMs = buildBoundaryTimestamp(fromIso, fromTimeStr, true);
  const toMs = buildBoundaryTimestamp(toIso, toTimeStr, false);

  const searchStr = (($("journalSearch")?.value) || "").trim().toLowerCase();

  const reports = loadReports();

  const filtered = reports.filter((r) => {
    const parsed = parseReportText(r.text);
    const impactMs = buildImpactTimestamp(parsed, r.ts);
    if (impactMs == null) return false;

    if (!Number.isNaN(fromMs) && impactMs < fromMs) return false;
    if (!Number.isNaN(toMs) && impactMs > toMs) return false;

    if (searchStr) {
      const hay = (r.text || "").toLowerCase();
      if (!hay.includes(searchStr)) return false;
    }

    return true;
  });

    // Newest first (by mission end time)
  filtered.sort((a, b) => {
    const pa = parseReportText(a.text);
    const pb = parseReportText(b.text);
    const ta = buildImpactTimestamp(pa, a.ts) ?? 0;
    const tb = buildImpactTimestamp(pb, b.ts) ?? 0;
    return tb - ta;
  });

  // Always clear cards
  cardsEl.textContent = "";

  if (filtered.length === 0) {
    summaryEl.textContent = "За обраний період звітів не знайдено.";
    updateKPI(0, 0, 0);
    return;
  }

  const counts = {
    total: filtered.length,
    drones: new Map(),
    ammo: new Map(),
    missionTypes: new Map(),
    results: new Map(),
  };

  // KPI simple heuristic (temporary): count "Ураження" vs "Втрата" by substring
  let hits = 0;
  let loss = 0;

  const allTexts = [];

  // Render cards
  for (const item of filtered) {
    const parsed = parseReportText(item.text);

    const datePart =
      normalizeDateForHeader(parsed.date) ||
      String(item.ts || "").slice(0, 10) ||
      (parsed.date || "");

    const header = `${datePart} — ${parsed.crew || ""}`.trim();

    allTexts.push(item.text);

    // Count maps
    if (parsed.drone) inc(counts.drones, parsed.drone);
    if (parsed.ammo) inc(counts.ammo, parsed.ammo);
    if (parsed.missionType) inc(counts.missionTypes, parsed.missionType);
    if (parsed.result) {
      inc(counts.results, parsed.result);

      const r = parsed.result.toLowerCase();
      if (r.includes("уражен")) hits += 1;
      if (r.includes("втрата")) loss += 1;
    }

    // Card DOM
    const card = document.createElement("div");
    card.className = "journal-card";

    const head = document.createElement("div");
    head.className = "journal-card-head";

    const title = document.createElement("div");
    title.className = "journal-card-title";
    title.textContent = header;

    const actions = document.createElement("div");
    actions.className = "journal-card-actions";

    const btnCopyOne = document.createElement("button");
    btnCopyOne.type = "button";
    btnCopyOne.className = "btnSmall";
    btnCopyOne.textContent = "Copy";
    btnCopyOne.onclick = () => copyTextSmart(item.text);

    const btnShare = document.createElement("button");
    btnShare.type = "button";
    btnShare.className = "btnSmall";
    btnShare.textContent = "Share";
    btnShare.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ text: item.text });
        } catch {
          // user canceled or unsupported
        }
      } else {
        await copyTextSmart(item.text);
      }
    };

    actions.appendChild(btnCopyOne);
    actions.appendChild(btnShare);

    head.appendChild(title);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "journal-card-body";
    body.textContent = item.text;

    card.appendChild(head);
    card.appendChild(body);

    cardsEl.appendChild(card);
  }

  // Copy all
  const btnCopyAll = $("btnJournalCopyAll");
  if (btnCopyAll) {
    btnCopyAll.onclick = () => copyTextSmart(allTexts.join("\n\n---\n\n"));
  }

  // Summary text (as before)
  const parts = [];
  const fmtPeriod = (d, t) => (d ? (t ? `${d} ${t}` : d) : "");
  parts.push(`Період: ${fmtPeriod(fromIso, fromTimeStr)} → ${fmtPeriod(toIso, toTimeStr)}`);
  parts.push("");
  parts.push(`Кількість вильотів: ${counts.total}`);

  const block = (label, map) => {
    if (!map.size) return;
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n");
    parts.push(`${label}:\n${entries}`);
  };

  block("Бортів", counts.drones);
  block("Боєприпасів", counts.ammo);
  block("Типів місій", counts.missionTypes);
  block("Результатів", counts.results);

  summaryEl.textContent = parts.join("\n\n");

  // KPI
  updateKPI(counts.total, hits, loss);
}

/**
 * Helper to increment value in Map.
 * @param {Map<string, number>} map
 * @param {string} key
 */
function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * KPI render
 */
function updateKPI(total, hits, loss) {
  const kTotal = $("kpiTotal");
  const kHits = $("kpiHits");
  const kLoss = $("kpiLoss");
  const kRate = $("kpiRate");

  if (kTotal) kTotal.textContent = String(total);
  if (kHits) kHits.textContent = String(hits);
  if (kLoss) kLoss.textContent = String(loss);

  const rate = total ? Math.round((hits / total) * 100) : 0;
  if (kRate) kRate.textContent = `${rate}%`;
}

/**
 * Normalize "DD.MM.YYYY" -> "YYYY-MM-DD" for header if possible.
 */
function normalizeDateForHeader(dateStr) {
  const s = (dateStr || "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return "";

  const dd = String(parseInt(m[1], 10)).padStart(2, "0");
  const mm = String(parseInt(m[2], 10)).padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Builds timestamp (ms) from report's date and impact time, or falls back to stored ts.
 * @param {{date?: string, impactTime?: string}} parsed
 * @param {string} fallbackTs
 * @returns {number|null}
 */
function buildImpactTimestamp(parsed, fallbackTs) {
  // Prefer parsed DD.MM.YYYY + HH:MM
  const iso = normalizeDateForHeader(parsed?.date || "");
  const time = (parsed?.impactTime || "").trim();

  if (iso && time) {
    const base = Date.parse(iso); // local midnight
    if (!Number.isNaN(base)) {
      const parts = time.split(":");
      const hour = parseInt(parts[0] || "0", 10);
      const minute = parseInt(parts[1] || "0", 10);
      const d = new Date(base);
      d.setHours(hour || 0, minute || 0, 0, 0);
      const ms = d.getTime();
      if (!Number.isNaN(ms)) return ms;
    }
  }

  const fb = Date.parse(fallbackTs);
  if (Number.isNaN(fb)) return null;
  return fb;
}

/**
 * Builds boundary timestamp from date+time inputs.
 * @param {string} isoDate - "YYYY-MM-DD" or "".
 * @param {string} timeStr - "HH:MM" or "".
 * @param {boolean} isStart - true for start (from), false for end (to).
 * @returns {number} ms or NaN if date is not provided.
 */
function buildBoundaryTimestamp(isoDate, timeStr, isStart) {
  if (!isoDate) return NaN;

  const base = Date.parse(isoDate);
  if (Number.isNaN(base)) return NaN;

  if (!timeStr) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }

  const parts = timeStr.split(":");
  const hour = parseInt(parts[0] || "0", 10);
  const minute = parseInt(parts[1] || "0", 10);

  const d = new Date(base);
  d.setHours(hour || 0, minute || 0, isStart ? 0 : 59, isStart ? 0 : 999);
  const ms = d.getTime();
  if (Number.isNaN(ms)) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }
  return ms;
}

/**
 * Copies text to clipboard with fallback.
 * @param {string} text
 */
async function copyTextSmart(text) {
  const t = (text || "").trim();
  if (!t) return;

  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}