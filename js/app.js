/**
 * Application entry: initialize all screens and navigation.
 * Точка входу додатку: ініціалізація екранів та навігації.
 * @module app
 */

import { initMainFormScreen } from "./screens/mainForm.js";
import { initJournalScreen } from "./screens/journal.js";
import { initSettingsScreen } from "./screens/settings.js";
import { initNavigation } from "./navigation.js";

/**
 * Initializes application screens and navigation.
 * Ініціалізує екрани додатку та навігацію між ними.
 * @returns {Promise<void>}
 */
async function initApp() {
  await initMainFormScreen();
  initJournalScreen();
  await initSettingsScreen();
  initNavigation();
}

initApp();
