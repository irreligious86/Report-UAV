/**
 * Map screen: display all saved report points on Leaflet map.
 * Екран мапи: показ усіх збережених точок звітів на Leaflet-мапі.
 * @module screens/map
 */

import { loadReports } from "../history.js";
import { $, setStatus } from "../utils.js";
import { copyText } from "../clipboard.js";
import { toPoint } from "https://esm.sh/mgrs@2.1.0";
import { loadPeriodFilter, isWithinPeriodFilter, getImpactTimestampForReport } from "../filters.js";

let initialized = false;
let map = null;
let markersLayer = null;
let activeMissionGroup = null;
let activeReport = null;

function createMarkerIcon(count) {
  const safeCount = Number.isFinite(count) && count > 0 ? count : 1;

  if (safeCount === 1) {
    const size = 22;

    return window.L.divIcon({
      className: "map-marker-wrapper",
      html: `<div class="map-marker-dot"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  let size = 34;
  let variantClass = "is-low";

  if (safeCount >= 4 && safeCount <= 5) {
    size = 40;
    variantClass = "is-medium";
  } else if (safeCount >= 6) {
    size = 46;
    variantClass = "is-high";
  }

  return window.L.divIcon({
    className: "map-marker-wrapper",
    html: `<div class="map-marker-badge ${variantClass}" style="width:${size}px;height:${size}px;">${safeCount}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size * 0.45)],
  });
}

function parseReportText(text) {
  const lines = String(text || "").split("\n");
  const result = {
    title: "",
    date: "",
    impactTime: "",
    coords: "",
  };

  if (lines[0]) result.title = lines[0].trim();
  if (lines[1]) result.date = lines[1].trim();

  for (const line of lines.slice(2)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (key === "Час ураження/втрати") result.impactTime = value;
    if (key === "Координати") result.coords = value;
  }

  return result;
}

function buildMissionListTitle(reportText) {
  const parsed = parseReportText(reportText);
  const parts = [];

  if (parsed.title) parts.push(parsed.title);
  if (parsed.date) parts.push(parsed.date);
  if (parsed.impactTime) parts.push(parsed.impactTime);

  return parts.join(" • ") || "Місія";
}

function getSortableMissionTimestamp(report) {
  const parsed = parseReportText(report?.text || "");

  if (parsed.date && parsed.impactTime) {
    const dateParts = parsed.date.split(".");
    const timeParts = parsed.impactTime.split(":");

    if (dateParts.length === 3 && timeParts.length >= 2) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);

      const d = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
      const ms = d.getTime();

      if (!Number.isNaN(ms)) {
        return ms;
      }
    }
  }

  const fallback = Date.parse(report?.ts || "");
  if (!Number.isNaN(fallback)) {
    return fallback;
  }

  return 0;
}

function closeMapOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.add("screenHidden");
  overlayEl.setAttribute("aria-hidden", "true");
}

function openMapOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove("screenHidden");
  overlayEl.setAttribute("aria-hidden", "false");
}

async function shareReportText(report) {
  const text = String(report?.text || "").trim();
  if (!text) {
    setStatus("Немає тексту для поширення.");
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Звіт місії",
        text,
      });
      setStatus("Звіт передано в меню поширення.");
      return;
    }

    const copied = await copyText(text);
    setStatus(
      copied
        ? "Меню поширення недоступне. Текст скопійовано."
        : "Меню поширення недоступне."
    );
  } catch (err) {
    if (err && err.name === "AbortError") {
      return;
    }

    const copied = await copyText(text);
    setStatus(
      copied
        ? "Не вдалося відкрити поширення. Текст скопійовано."
        : "Не вдалося відкрити поширення."
    );
  }
}

function renderSingleReportOverlay(report, group = null) {
  const reportOverlay = $("mapReportOverlay");
  const titleEl = $("mapReportTitle");
  const subtitleEl = $("mapReportSubtitle");
  const contentEl = $("mapReportContent");

  if (!reportOverlay || !titleEl || !subtitleEl || !contentEl) return;

  activeMissionGroup = group;
  activeReport = report || null;

  const parsed = parseReportText(report?.text || "");
  titleEl.textContent = buildMissionListTitle(report?.text || "");
  subtitleEl.textContent = parsed.coords || "";
  contentEl.textContent = report?.text || "";

  openMapOverlay(reportOverlay);
}

function renderMissionGroupOverlay(group) {
  const groupOverlay = $("mapGroupOverlay");
  const titleEl = $("mapGroupTitle");
  const subtitleEl = $("mapGroupSubtitle");
  const listEl = $("mapMissionList");

  if (!groupOverlay || !titleEl || !subtitleEl || !listEl) return;

  titleEl.textContent = `Місії у точці: ${group.reports.length}`;
  subtitleEl.textContent = group.coordsText || "";

  listEl.innerHTML = "";

  const sortedReports = [...group.reports].sort((a, b) => {
    return getSortableMissionTimestamp(b) - getSortableMissionTimestamp(a);
  });

  sortedReports.forEach((report, index) => {
    const parsed = parseReportText(report?.text || "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-mission-item";

    btn.innerHTML = `
      <span class="map-mission-item-title">${escapeHtml(buildMissionListTitle(report?.text || ""))}</span>
      <span class="map-mission-item-meta">
        ${parsed.impactTime ? `Час: ${escapeHtml(parsed.impactTime)}` : `Місія ${index + 1}`}
        ${parsed.coords ? ` • ${escapeHtml(parsed.coords)}` : ""}
      </span>
    `;

    btn.addEventListener("click", () => {
      renderSingleReportOverlay(report, group);
    });

    listEl.appendChild(btn);
  });

  openMapOverlay(groupOverlay);
}

function initMapOverlays() {
  const groupOverlay = $("mapGroupOverlay");
  const reportOverlay = $("mapReportOverlay");

  const groupCloseBtn = $("mapGroupCloseBtn");
  const reportCloseBtn = $("mapReportCloseBtn");
  const reportBackBtn = $("mapReportBackBtn");
  const copyBtn = $("mapReportCopyBtn");
  const shareBtn = $("mapReportShareBtn");

  if (groupCloseBtn) {
    groupCloseBtn.onclick = () => closeMapOverlay(groupOverlay);
  }

  if (reportCloseBtn) {
    reportCloseBtn.onclick = () => {
      activeMissionGroup = null;
      activeReport = null;
      closeMapOverlay(reportOverlay);
    };
  }

  if (reportBackBtn) {
    reportBackBtn.onclick = () => {
      closeMapOverlay(reportOverlay);

      if (activeMissionGroup) {
        renderMissionGroupOverlay(activeMissionGroup);
      }
    };
  }

  document.querySelectorAll("[data-map-overlay-close='group']").forEach((el) => {
    el.addEventListener("click", () => closeMapOverlay(groupOverlay));
  });

  document.querySelectorAll("[data-map-overlay-close='report']").forEach((el) => {
    el.addEventListener("click", () => {
      activeMissionGroup = null;
      activeReport = null;
      closeMapOverlay(reportOverlay);
    });
  });

  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = String(activeReport?.text || "").trim();
      if (!text) {
        setStatus("Немає тексту для копіювання.");
        return;
      }

      const ok = await copyText(text);
      setStatus(ok ? "Звіт скопійовано." : "Помилка копіювання.");
    };
  }

  if (shareBtn) {
    shareBtn.onclick = async () => {
      await shareReportText(activeReport);
    };
  }
}

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

  const groupedByCoords = new Map();

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

    const key = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;

    if (!groupedByCoords.has(key)) {
      groupedByCoords.set(key, {
        pos,
        coordsText,
        reports: [],
      });
    }

    groupedByCoords.get(key).reports.push(report);
  }

  for (const group of groupedByCoords.values()) {
    const { pos, reports } = group;
    const marker = window.L.marker([pos.lat, pos.lng], {
      icon: createMarkerIcon(reports.length),
    });

    if (reports.length === 1) {
      const report = reports[0];
      marker.on("click", () => {
        renderSingleReportOverlay(report, null);
      });
    } else {
      marker.on("click", () => {
        renderMissionGroupOverlay(group);
      });
    }

    marker.addTo(markersLayer);
    bounds.push([pos.lat, pos.lng]);
    validCount += reports.length;
  }

  if (validCount > 0) {
    map.fitBounds(bounds, { padding: [24, 24] });
    if (statusEl) {
      statusEl.textContent =
        invalidCount > 0
          ? `Показано місій: ${validCount}. Пропущено некоректних координат: ${invalidCount}.`
          : `Показано місій: ${validCount}.`;
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

  initMapOverlays();

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

// --- Overlay helpers -------------------------------------------------------

/** @type {{ pos: {lat:number,lng:number}, coordsText: string, reports: Array<{text:string}> } | null} */
let lastGroupForReport = null;

function openGroupOverlay(group) {
  const overlay = $("mapGroupOverlay");
  const titleEl = $("mapGroupTitle");
  const subtitleEl = $("mapGroupSubtitle");
  const listEl = $("mapMissionList");
  if (!overlay || !subtitleEl || !listEl) return;

  lastGroupForReport = group;

  overlay.classList.remove("screenHidden");
  overlay.setAttribute("aria-hidden", "false");

  if (titleEl) {
    titleEl.textContent = `Місії у точці: ${group.reports.length}`;
  }
  subtitleEl.textContent = group.coordsText || "";

  listEl.textContent = "";

  group.reports.forEach((report, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-mission-item";

    const t = document.createElement("span");
    t.className = "map-mission-item-title";
    t.textContent = `Місія ${index + 1}`;

    const meta = document.createElement("span");
    meta.className = "map-mission-item-meta";
    meta.textContent = extractPopupTitle(report.text);

    btn.appendChild(t);
    btn.appendChild(meta);

    btn.onclick = () => openReportOverlay(report, index + 1, group);

    listEl.appendChild(btn);
  });

  listEl.scrollTop = 0;
}

function closeGroupOverlay() {
  const overlay = $("mapGroupOverlay");
  if (!overlay) return;
  overlay.classList.add("screenHidden");
  overlay.setAttribute("aria-hidden", "true");
}

function reopenLastGroupOverlay() {
  if (lastGroupForReport) {
    openGroupOverlay(lastGroupForReport);
  }
}

function openReportOverlay(report, index, group) {
  const overlay = $("mapReportOverlay");
  const titleEl = $("mapReportTitle");
  const subtitleEl = $("mapReportSubtitle");
  const contentEl = $("mapReportContent");
  if (!overlay || !subtitleEl || !contentEl) return;

  overlay.classList.remove("screenHidden");
  overlay.setAttribute("aria-hidden", "false");

  if (titleEl) {
    titleEl.textContent = `Місія ${index}`;
  }

  const label = extractPopupTitle(report.text);
  subtitleEl.textContent = `${label} • ${group.coordsText || ""}`;

  contentEl.textContent = report.text || "";
}

function closeReportOverlay() {
  const overlay = $("mapReportOverlay");
  if (!overlay) return;
  overlay.classList.add("screenHidden");
  overlay.setAttribute("aria-hidden", "true");
}
