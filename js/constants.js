/**
 * Application constants.
 * Константы приложения.
 * @module constants
 */

/** URL of the JSON configuration file (relative to the document). */
/** URL файла конфигурации JSON (относительно документа). */
export const CONFIG_URL = "./config.json";

/** localStorage key for the crew counter value (1–25). Bump version to reset stored counter. */
/** Ключ localStorage для значения счётчика экипажа (1–25). Изменение версии сбрасывает сохранённое значение. */
export const STORAGE_KEY_COUNTER = "uav_report_counter_v13";

/** Placeholder text for the stream field when empty. */
/** Подстановочный текст для поля «Стрім», если оно пустое. */
export const STREAM_PLACEHOLDER = "---";

/** localStorage key for the report history array. */
/** Ключ localStorage для массива истории отчётов. */
export const STORAGE_KEY_REPORTS = "uav_report_history_v1";

/** Maximum number of reports to keep in history; older entries are dropped. */
/** Максимальное количество отчётов в истории; старые записи удаляются. */
export const REPORTS_LIMIT = 200;

/** localStorage key for user overrides of config.json lists/defaults (settings screen). */
/** Ключ localStorage для пользовательских переопределений config.json (экран настроек). */
export const STORAGE_KEY_CONFIG_OVERRIDES = "uav_report_config_overrides_v1";

/** localStorage key for known stream values collected from reports. */
/** Ключ localStorage для списка значений поля «Стрім», собранных из отчётов. */
export const STORAGE_KEY_STREAMS = "uav_report_streams_v1";
