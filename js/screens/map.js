/**
 * Map screen: display all saved report points on Leaflet map.
 * Екран мапи: показ усіх збережених точок звітів на Leaflet-мапі.
 * @module screens/map
 */

import { loadReports } from "../history.js";
import { $ } from "../utils.js";
import { toPoint } from "https://esm.sh/mgrs@2.1.0";
import { loadPeriodFilter, isWithinPeriodFilter, getImpactTimestampForReport } from "../filters.js";

let initialized = false;
let map = null;
let markersLayer = null;

/**
 * Extracts coordinate line from report text.
 * Витягує рядок координат із тексту звіту.
 * @param {string} text
 * @returns {string}
 */
function extractCoords(text) {
  const match = String(text || "").match(/^Координати:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

/**
 * Extracts short title from report text.
 * Витягує короткий заголовок для popup.
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
 * Safe HTML escaping for popup content.
 * Безпечне екранування HTML для popup.
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
 * Converts MGRS string to Leaflet lat/lng.
 * Конвертує MGRS-рядок у Leaflet lat/lng.
 * @param {string} mgrsText
 * @returns {{lat:number,lng:number}|null}
 */
function mgrsToLatLng(mgrsText) {
  try {
    const point = toPoint(mgrsText); // returns [lon, lat]
    if (!Array.isArray(point) || point.length < 2) return null;

    const [lng, lat] = point;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Renders all saved reports as markers on the map.
 * Малює всі збережені звіти як маркери на мапі.
 */
function renderReportsOnMap() {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();

  const statusEl = $("mapStatus");
  const period = loadPeriodFilter();
  const reports = loadReports();

  const filtered = reports.filter((report) => {
    const impactMs = getImpactTimestampForReport(report);
    if (impactMs == null) return false;
    return isWithinPeriodFilter(impactMs, period);
  });

  if (!filtered.length) {
    if (statusEl) statusEl.textContent = "У журналі ще немає збережених звітів.";
    map.setView([48.3794, 31.1656], 6);
    return;
  }

  const bounds = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const report of filtered) {
    const coordsText = extractCoords(report?.text || "");
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
        <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(extractPopupTitle(report.text))}</div>
        <div style="font-size:12px; opacity:.8; margin-bottom:6px;">${escapeHtml(coordsText)}</div>
        <div style="white-space:pre-wrap; font-size:12px;">${escapeHtml(report.text)}</div>
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
          ? `Показано точок: ${validCount}. Пропущено некоректних координат: ${invalidCount}.`
          : `Показано точок: ${validCount}.`;
    }
  } else {
    map.setView([48.3794, 31.1656], 6);
    if (statusEl) {
      statusEl.textContent = "Не вдалося розпізнати координати у збережених звітах.";
    }
  }
}

/**
 * Initializes map screen once.
 * Ініціалізує екран мапи (одноразово).
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

  // Leaflet needs a size refresh when map was hidden.
  window.setTimeout(() => {
    map.invalidateSize();
    renderReportsOnMap();
  }, 60);
}