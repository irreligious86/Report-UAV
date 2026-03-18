/**
 * Result mapping helpers: convert raw user-entered result text
 * into normalized categories for statistics.
 * @module result-mapping
 */

/**
 * Normalized result categories used by statistics.
 * These values should stay stable so old reports remain compatible.
 */
export const RESULT_CATEGORIES = Object.freeze({
  HIT: "Ураження",
  MISS: "Не уражено",
  BREAK: "Обрив",
  LOSS: "Втрата борта",
  CANCELED: "Скасовано",
  OTHER: "Інше",
});

/**
 * Exact full-string mappings.
 * Keys are stored in lowercase to simplify comparisons.
 */
const EXACT_RESULT_MAP = new Map([
  ["ураження", RESULT_CATEGORIES.HIT],
  ["ураження цілі", RESULT_CATEGORIES.HIT],
  ["ураження укриття", RESULT_CATEGORIES.HIT],

  ["не уражено", RESULT_CATEGORIES.MISS],
  ["не знайдено цілі", RESULT_CATEGORIES.MISS],

  ["обрив", RESULT_CATEGORIES.BREAK],
  ["обрив біля цілі", RESULT_CATEGORIES.BREAK],

  ["втрата борта", RESULT_CATEGORIES.LOSS],
  ["розрядився акум", RESULT_CATEGORIES.LOSS],

  ["скасовано", RESULT_CATEGORIES.CANCELED],
]);

/**
 * Partial-match keyword rules.
 * The first matching rule wins.
 */
const KEYWORD_RULES = [
  {
    keywords: ["ураження", "уражено"],
    category: RESULT_CATEGORIES.HIT,
  },
  {
    keywords: ["не уражено", "не знайдено", "не знайдено цілі"],
    category: RESULT_CATEGORIES.MISS,
  },
  {
    keywords: ["обрив"],
    category: RESULT_CATEGORIES.BREAK,
  },
  {
    keywords: ["втрата", "розрядився", "розрядився акум", "втрата борта"],
    category: RESULT_CATEGORIES.LOSS,
  },
  {
    keywords: ["скасовано", "відмінено"],
    category: RESULT_CATEGORIES.CANCELED,
  },
];

/**
 * Normalizes raw result text for robust comparison.
 * - trims spaces
 * - lowercases
 * - collapses repeated whitespace
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeResultText(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Maps a raw result string to a normalized statistics category.
 *
 * Matching strategy:
 * 1. exact full-string match
 * 2. partial keyword match
 * 3. fallback to "Інше"
 *
 * @param {string} raw
 * @returns {string}
 */
export function mapResultToCategory(raw) {
  const normalized = normalizeResultText(raw);

  if (!normalized) {
    return RESULT_CATEGORIES.OTHER;
  }

  const exact = EXACT_RESULT_MAP.get(normalized);
  if (exact) {
    return exact;
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return RESULT_CATEGORIES.OTHER;
}

