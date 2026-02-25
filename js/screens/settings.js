/**
 * Settings screen: editing local lists for selects/datalists and streams.
 * Екран налаштувань: редагування локальних списків для select/datalist та стрімів.
 * @module screens/settings
 */

import { $ } from "../utils.js";
import {
  loadConfig,
  loadConfigOverrides,
  saveConfigOverrides,
  applyConfigWithOverrides,
} from "../config.js";
import { loadStreams, saveStreams } from "../streams.js";

let initialized = false;

/**
 * Initializes the settings screen once.
 * Ініціалізує екран налаштувань (одноразово).
 */
export async function initSettingsScreen() {
  if (initialized) return;
  initialized = true;

  await refreshFromConfig();

  const btnSave = $("btnSettingsSave");
  if (btnSave) {
    btnSave.onclick = async () => {
      await handleSave();
    };
  }

  const btnReset = $("btnSettingsReset");
  if (btnReset) {
    btnReset.onclick = async () => {
      await handleReset();
    };
  }
}

async function refreshFromConfig() {
  const baseCfg = await loadConfig();
  const overrides = loadConfigOverrides();
  const lists = {
    ...(baseCfg.lists || {}),
    ...(overrides.lists || {}),
  };

  setTextareaFromList("settingsDrones", lists.drones);
  setTextareaFromList("settingsMissionTypes", lists.missionTypes);
  setTextareaFromList("settingsAmmo", lists.ammo);
  setTextareaFromList("settingsResults", lists.results);
  setTextareaFromList("settingsMgrsPrefixes", lists.mgrsPrefixes);

  const streams = loadStreams();
  setTextareaFromList("settingsStreams", streams);
}

function setTextareaFromList(id, list) {
  const el = $(id);
  if (!el) return;
  const arr = Array.isArray(list) ? list : [];
  el.value = arr.join("\n");
}

function getListFromTextarea(id) {
  const el = $(id);
  if (!el) return [];
  return el.value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function handleSave() {
  const statusEl = $("settingsStatus");

  const overrides = {
    lists: {
      drones: getListFromTextarea("settingsDrones"),
      missionTypes: getListFromTextarea("settingsMissionTypes"),
      ammo: getListFromTextarea("settingsAmmo"),
      results: getListFromTextarea("settingsResults"),
      mgrsPrefixes: getListFromTextarea("settingsMgrsPrefixes"),
    },
  };

  saveConfigOverrides(overrides);

  const streams = getListFromTextarea("settingsStreams");
  saveStreams(streams);

  // Re-apply config to main form so selects/datalists reflect changes.
  const baseCfg = await loadConfig();
  applyConfigWithOverrides(baseCfg, overrides);

  if (statusEl) statusEl.textContent = "Зміни збережено (локально).";
}

async function handleReset() {
  const statusEl = $("settingsStatus");

  saveConfigOverrides(null);

  const baseCfg = await loadConfig();
  applyConfigWithOverrides(baseCfg, {});

  // Streams are not reset automatically — користувач може очистити вручну у полі.
  await refreshFromConfig();

  if (statusEl) statusEl.textContent = "Налаштування повернено до config.json.";
}

