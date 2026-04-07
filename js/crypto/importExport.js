/**
 * Encrypted reports import/export helpers.
 * Reads reports via history.js, encrypts them into a downloadable file,
 * and imports encrypted files back through the same storage layer.
 * @module crypto/importExport
 */

import { loadReports, saveReports, newReportId } from "../history.js";
import { REPORTS_LIMIT } from "../constants.js";
import { encryptJSON, decryptJSON } from "./crypto.js";

const EXPORT_FILE_NAME = "uav_reports.enc.json";

/**
 * Checks whether a value looks like a valid report object.
 * @param {unknown} item
 * @returns {boolean}
 */
function isValidReport(item) {
  return (
    !!item &&
    typeof item === "object" &&
    typeof item.ts === "string" &&
    typeof item.text === "string" &&
    item.ts.trim() !== "" &&
    item.text.trim() !== "" &&
    (item.id === undefined || typeof item.id === "string")
  );
}

/**
 * @param {{ ts: string, text: string, id?: string }} report
 * @returns {{ id: string, ts: string, text: string }}
 */
function withStableId(report) {
  const id =
    report.id && String(report.id).trim()
      ? String(report.id).trim()
      : newReportId();
  return { id, ts: report.ts, text: report.text };
}

/**
 * Validates the decrypted payload structure.
 * Supports either:
 *   1) array of reports
 *   2) object with { reports: [...] }
 *
 * @param {unknown} payload
 * @returns {Array<{ ts: string, text: string }>}
 */
function extractReportsArray(payload) {
  if (Array.isArray(payload)) {
    if (!payload.every(isValidReport)) {
      throw new Error("Decrypted JSON contains invalid report items.");
    }
    return payload;
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.reports)) {
    if (!payload.reports.every(isValidReport)) {
      throw new Error("Decrypted JSON contains invalid report items.");
    }
    return payload.reports;
  }

  throw new Error("Decrypted JSON has unsupported structure.");
}

/**
 * Builds a stable dedupe key for a report.
 * @param {{ ts: string, text: string }} report
 * @returns {string}
 */
function makeReportKey(report) {
  return `${report.ts}__${report.text}`;
}

/**
 * Merges reports without duplicates.
 * Keeps chronological order by timestamp if possible.
 *
 * @param {Array<{ ts: string, text: string }>} currentReports
 * @param {Array<{ ts: string, text: string }>} importedReports
 * @returns {Array<{ ts: string, text: string }>}
 */
function mergeReports(currentReports, importedReports) {
  const map = new Map();

  for (const report of currentReports) {
    const r = withStableId(report);
    map.set(makeReportKey(r), r);
  }

  for (const report of importedReports) {
    const r = withStableId(report);
    map.set(makeReportKey(r), r);
  }

  const merged = Array.from(map.values());

  merged.sort((a, b) => {
    const aMs = Date.parse(a.ts);
    const bMs = Date.parse(b.ts);

    if (Number.isNaN(aMs) && Number.isNaN(bMs)) return 0;
    if (Number.isNaN(aMs)) return 1;
    if (Number.isNaN(bMs)) return -1;

    return aMs - bMs;
  });

  if (merged.length > REPORTS_LIMIT) {
    return merged.slice(-REPORTS_LIMIT);
  }

  return merged;
}

/**
 * Converts a string into a downloadable JSON file.
 * @param {string} content
 * @param {string} fileName
 */
function downloadTextFile(content, fileName) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/**
 * Reads a File object as text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read selected file."));
    };

    reader.readAsText(file);
  });
}

/**
 * Exports current reports into an encrypted JSON file.
 *
 * Output structure before encryption:
 * {
 *   kind: "uav-reports-export",
 *   version: 1,
 *   exportedAt: "...",
 *   reports: [...]
 * }
 *
 * @param {string} passphrase
 * @returns {Promise<{ fileName: string, count: number }>}
 */
export async function exportEncryptedReports(passphrase) {
  const reports = loadReports();

  const exportPayload = {
    kind: "uav-reports-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    reports,
  };

  const encryptedPayload = await encryptJSON(exportPayload, passphrase);
  const fileContent = JSON.stringify(encryptedPayload, null, 2);

  downloadTextFile(fileContent, EXPORT_FILE_NAME);

  return {
    fileName: EXPORT_FILE_NAME,
    count: reports.length,
  };
}

/**
 * Imports reports from an encrypted JSON file and merges them into localStorage.
 *
 * @param {File} file
 * @param {string} passphrase
 * @returns {Promise<{
 *   imported: number,
 *   before: number,
 *   after: number,
 *   added: number
 * }>}
 */
export async function importEncryptedReports(file, passphrase) {
  if (!(file instanceof File)) {
    throw new Error("No file selected.");
  }

  const fileText = await readFileAsText(file);

  let encryptedPayload;
  try {
    encryptedPayload = JSON.parse(fileText);
  } catch {
    throw new Error("Selected file is not valid JSON.");
  }

  const decryptedPayload = await decryptJSON(encryptedPayload, passphrase);
  const importedReports = extractReportsArray(decryptedPayload);
  const currentReports = loadReports();
  const mergedReports = mergeReports(currentReports, importedReports);

  saveReports(mergedReports);

  return {
    imported: importedReports.length,
    before: currentReports.length,
    after: mergedReports.length,
    added: mergedReports.length - currentReports.length,
  };
}

