/**
 * IndexedDB storage for UAV reports.
 * Migrates existing reports from localStorage on first init.
 * @module reportsDb
 */

import { STORAGE_KEY_REPORTS, REPORTS_LIMIT } from "./constants.js";

const DB_NAME = "report_uav_db";
const DB_VERSION = 1;
const STORE_REPORTS = "reports";

let dbPromise = null;

/**
 * Opens IndexedDB and creates object store if needed.
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        const store = db.createObjectStore(STORE_REPORTS, {
          keyPath: "id",
          autoIncrement: true,
        });

        store.createIndex("ts", "ts", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Failed to open IndexedDB."));
  });

  return dbPromise;
}

/**
 * Wraps IDBRequest into Promise.
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB request failed."));
  });
}

/**
 * Returns all reports sorted by timestamp ascending.
 * @returns {Promise<Array<{ id?: number, ts: string, text: string }>>}
 */
export async function getAllReports() {
  const db = await openDb();

  const tx = db.transaction(STORE_REPORTS, "readonly");
  const store = tx.objectStore(STORE_REPORTS);
  const items = await requestToPromise(store.getAll());

  items.sort((a, b) => {
    const aMs = Date.parse(a.ts);
    const bMs = Date.parse(b.ts);

    if (Number.isNaN(aMs) && Number.isNaN(bMs)) return 0;
    if (Number.isNaN(aMs)) return 1;
    if (Number.isNaN(bMs)) return -1;

    return aMs - bMs;
  });

  return items;
}

/**
 * Adds one report and enforces REPORTS_LIMIT.
 * @param {{ ts: string, text: string }} report
 * @returns {Promise<void>}
 */
export async function addReportToDb(report) {
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, "readwrite");
    const store = tx.objectStore(STORE_REPORTS);

    store.add({
      ts: report.ts,
      text: report.text,
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to add report."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });

  await enforceReportsLimit();
}

/**
 * Replaces all reports with provided list.
 * @param {Array<{ ts: string, text: string }>} reports
 * @returns {Promise<void>}
 */
export async function replaceAllReports(reports) {
  const db = await openDb();
  const trimmed = Array.isArray(reports) ? reports.slice(-REPORTS_LIMIT) : [];

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, "readwrite");
    const store = tx.objectStore(STORE_REPORTS);

    store.clear();

    for (const item of trimmed) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.ts === "string" &&
        typeof item.text === "string"
      ) {
        store.add({
          ts: item.ts,
          text: item.text,
        });
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to replace reports."));
    tx.onabort = () =>
      reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

/**
 * Clears reports store.
 * @returns {Promise<void>}
 */
export async function clearReportsDb() {
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, "readwrite");
    const store = tx.objectStore(STORE_REPORTS);

    store.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to clear reports store."));
    tx.onabort = () =>
      reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

/**
 * Migrates legacy localStorage reports into IndexedDB once.
 * If IndexedDB already has data, migration is skipped.
 * @returns {Promise<void>}
 */
export async function initReportsDb() {
  const existing = await getAllReports();
  if (existing.length > 0) return;

  let legacyReports = [];
  try {
    legacyReports = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS)) || [];
  } catch {
    legacyReports = [];
  }

  if (!Array.isArray(legacyReports) || legacyReports.length === 0) return;

  await replaceAllReports(legacyReports);
  localStorage.removeItem(STORAGE_KEY_REPORTS);
}

/**
 * Deletes oldest items when total exceeds REPORTS_LIMIT.
 * @returns {Promise<void>}
 */
async function enforceReportsLimit() {
  const db = await openDb();
  const reports = await getAllReports();

  if (reports.length <= REPORTS_LIMIT) return;

  const overflow = reports.length - REPORTS_LIMIT;
  const toDelete = reports.slice(0, overflow);

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, "readwrite");
    const store = tx.objectStore(STORE_REPORTS);

    for (const item of toDelete) {
      if (typeof item.id === "number") {
        store.delete(item.id);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Failed to enforce reports limit."));
    tx.onabort = () =>
      reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

