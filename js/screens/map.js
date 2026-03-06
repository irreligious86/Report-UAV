/**
 * Map screen: display saved report points on Leaflet map.
 * Екран мапи: показ збережених точок звітів на Leaflet-мапі.
 * @module screens/map
 */

import { $ } from "../utils.js";
import { loadReports } from "../history.js";
import { loadPeriodFilter } from "../filters.js";

let initialized = false;
let map = null;
let markersLayer = null;

/**
 * Extract coordinates line from report text.
 * Витягує рядок координат із тексту звіту.
 * @param {string} text
 * @returns {string}
 */
function extractCoords(text) {
  const match = String(text || "").match(/^Координати:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

/**
 * Extract short title for marker popup.
 * Витягує короткий заголовок для popup маркера.
 * @param {string} text
 * @returns {string}
 */
function extractPopupTitle(text) {
  const lines = String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const crew = lines[0] || "Без назви";
  const date = lines[1] || "";
  return date ? `${crew} • ${date}` : crew;
}

/**
 * Escape HTML for popup safety.
 * Екранує HTML для безпечного popup.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Parses structured fields from generated report text.
 * Розбирає структуровані поля з тексту звіту.
 * @param {string} text
 * @returns {{date?: string, impactTime?: string}}
 */
function parseReportText(text) {
  const lines = String(text || "").split("\n");
  const out = {};

  if (lines[1]) out.date = lines[1].trim();

  for (const line of lines.slice(2)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (key === "Час ураження/втрати") {
      out.impactTime = value;
    }
  }

  return out;
}

/**
 * Builds timestamp (ms) from report date and impact time, or falls back to stored ts.
 * Повертає мітку часу (мс) з дати звіту та часу ураження, або з ts, якщо дані відсутні.
 * @param {{date?: string, impactTime?: string}} parsed
 * @param {string} fallbackTs
 * @returns {number|null}
 */
function buildImpactTimestamp(parsed, fallbackTs) {
  if (parsed && parsed.date && parsed.impactTime) {
    const dateParts = parsed.date.split(".");
    const timeParts = parsed.impactTime.split(":");

    if (dateParts.length === 3 && timeParts.length >= 2) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);

      const d = new Date(year, month - 1, day, hour, minute || 0, 0, 0);
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
 * Повертає мітку часу межі з полів дати/часу.
 * @param {string} isoDate
 * @param {string} timeStr
 * @param {boolean} isStart
 * @returns {number}
 */
function buildBoundaryTimestamp(isoDate, timeStr, isStart) {
  if (!isoDate) return NaN;

  const base = Date.parse(isoDate);
  if (Number.isNaN(base)) return NaN;

  if (!timeStr) {
    if (isStart) return base;
    return base + 24 * 60 * 60 * 1000 - 1;
  }

  const parts = timeStr.split(":");
  if (parts.length < 2) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }

  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  const d = new Date(base);
  d.setHours(hour || 0, minute || 0, isStart ? 0 : 59, isStart ? 0 : 999);

  const ms = d.getTime();
  if (Number.isNaN(ms)) {
    return isStart ? base : base + 24 * 60 * 60 * 1000 - 1;
  }

  return ms;
}

/**
 * Checks if report is inside currently selected shared period.
 * Перевіряє, чи входить звіт у поточний спільний період.
 * @param {{text:string, ts:string}} report
 * @returns {boolean}
 */
function isReportInSharedPeriod(report) {
  const filter = loadPeriodFilter();

  const fromMs = buildBoundaryTimestamp(filter.fromDate, filter.fromTime, true);
  const toMs = buildBoundaryTimestamp(filter.toDate, filter.toTime, false);

  const parsed = parseReportText(report?.text || "");
  const impactMs = buildImpactTimestamp(parsed, report?.ts);

  if (impactMs == null) return false;
  if (!Number.isNaN(fromMs) && impactMs < fromMs) return false;
  if (!Number.isNaN(toMs) && impactMs > toMs) return false;

  return true;
}

/**
 * Convert MGRS text to lat/lng using window.mgrs.
 * Конвертує MGRS-рядок у lat/lng через window.mgrs.
 * @param {string} mgrsText
 * @returns {{lat:number,lng:number}|null}
 */
function mgrsToLatLng(mgrsText) {
  try {
    if (!window.mgrs || typeof window.mgrs.toPoint !== "function") return null;

    // mgrs.toPoint returns [lon, lat]
    const point = window.mgrs.toPoint(mgrsText);
    if (!Array.isArray(point) || point.length < 2) return null;

    const [lng, lat] = point;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Builds human-readable filter caption.
 * Будує текстовий підпис поточного фільтра.
 * @returns {string}
 */
function buildPeriodCaption() {
  const filter = loadPeriodFilter();
  return `${filter.fromDate} ${filter.fromTime} → ${filter.toDate} ${filter.toTime}`;
}

/**
 * Draw all saved reports on map.
 * Малює всі збережені звіти на мапі.
 */
function renderReportsOnMap() {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();

  const statusEl = $("mapStatus");
  const reports = loadReports().filter(isReportInSharedPeriod);

  if (!reports.length) {
    if (statusEl) {
      statusEl.textContent = `За обраний період точок не знайдено. (${buildPeriodCaption()})`;
    }
    map.setView([48.3794, 31.1656], 6);
    return;
  }

  const bounds = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const report of reports) {
    const text = report?.text || "";
    const coordsText = extractCoords(text);

    if (!coordsText) {
      invalidCount += 1;
      continue;
    }

    const pos = mgrsToLatLng(coordsText);
    if (!pos) {
      invalidCount += 1;
      continue;
    }

    const popupHtml = `
      <div style="min-width:220px">
        <div style="font-weight:700; margin-bottom:6px;">
          ${escapeHtml(extractPopupTitle(text))}
        </div>
        <div style="font-size:12px; opacity:.8; margin-bottom:6px;">
          ${escapeHtml(coordsText)}
        </div>
        <div style="white-space:pre-wrap; font-size:12px;">
          ${escapeHtml(text)}
        </div>
      </div>
    `;

    const marker = window.L.marker([pos.lat, pos.lng]);
    marker.bindPopup(popupHtml);
    marker.addTo(markersLayer);

    bounds.push([pos.lat, pos.lng]);
    validCount += 1;
  }

  if (validCount > 0) {
    map.fitBounds(bounds, { padding: [24, 24] });

    if (statusEl) {
      statusEl.textContent =
        invalidCount > 0
          ? `Період: ${buildPeriodCaption()}. Показано точок: ${validCount}. Пропущено некоректних координат: ${invalidCount}.`
          : `Період: ${buildPeriodCaption()}. Показано точок: ${validCount}.`;
    }
  } else {
    map.setView([48.3794, 31.1656], 6);

    if (statusEl) {
      statusEl.textContent = `За обраний період не вдалося розпізнати координати. (${buildPeriodCaption()})`;
    }
  }
}

/**
 * Initialize map screen once.
 * Ініціалізує екран мапи одноразово.
 */
export function initMapScreen() {
  if (initialized) return;
  initialized = true;

  const mapEl = $("map");
  const statusEl = $("mapStatus");

  if (!mapEl) return;

  if (!window.L) {
    if (statusEl) statusEl.textContent = "Leaflet не завантажився.";
    return;
  }

  map = window.L.map(mapEl, {
    zoomControl: true,
    attributionControl: true,
  }).setView([48.3794, 31.1656], 6);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  markersLayer = window.L.layerGroup().addTo(map);

  if (statusEl) {
    statusEl.textContent = "Мапу ініціалізовано. Точки буде завантажено при відкритті екрана.";
  }
}

/**
 * Called when map screen becomes visible.
 * Викликається, коли екран мапи стає активним.
 */
export function onMapScreenShown() {
  if (!map) return;

  window.setTimeout(() => {
    map.invalidateSize();
    renderReportsOnMap();
  }, 60);
}