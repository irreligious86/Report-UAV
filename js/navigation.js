/**
 * Navigation between logical screens and long-press menu on the title.
 * Навигация между экранами и меню по долгому нажатию на заголовок.
 * @module navigation
 */

import { $ } from "./utils.js";

/** Known screen ids. Допустимые идентификаторы экранов. */
const SCREEN_IDS = ["main", "journal", "settings", "help"];

/** Current active screen id. Текущий активный экран. */
let currentScreenId = "main";

/** Long-press timer id. Идентификатор таймера долгого нажатия. */
let longPressTimer = null;

/** Cached menu root element. Корневой елемент меню. */
let menuElement = null;

/** Cached menu panel element (for animation). Елемент панелі меню (для анімації). */
let menuPanelElement = null;

/** Milliseconds required to treat press as long-press. Время в мс для срабатывания долгого нажатия. */
const LONG_PRESS_MS = 450;

/**
 * Initializes navigation: long-press on title and menu interactions.
 * Инициализирует навигацию: долгое нажатие на заголовок и обработка меню.
 */
export function initNavigation() {
  const titleEl = $("title");
  const menuEl = $("screenMenu");
  const backdropEl = $("screenMenuBackdrop");

  if (!titleEl || !menuEl) {
    return;
  }

  menuElement = menuEl;
  menuPanelElement = menuEl.querySelector(".screen-menu-panel");

  const startPress = () => {
    clearPress();
    longPressTimer = window.setTimeout(() => {
      openMenu();
    }, LONG_PRESS_MS);
  };

  const clearPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const openMenu = () => {
    menuEl.classList.add("is-open");
    menuEl.setAttribute("aria-hidden", "false");
  };

  const closeMenu = () => {
    menuEl.classList.remove("is-open");
    menuEl.setAttribute("aria-hidden", "true");
    clearPress();
  };

  // Mouse / touch bindings for long-press on title.
  titleEl.addEventListener("mousedown", startPress);
  titleEl.addEventListener("touchstart", startPress);

  titleEl.addEventListener("mouseup", clearPress);
  titleEl.addEventListener("mouseleave", clearPress);
  titleEl.addEventListener("touchend", clearPress);
  titleEl.addEventListener("touchcancel", clearPress);

  // Close on backdrop click.
  if (backdropEl) {
    backdropEl.addEventListener("click", () => {
      closeMenu();
    });
  }

  // Handle menu buttons.
  menuEl.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.screen) {
      const nextId = target.dataset.screen;
      const isOther = nextId !== currentScreenId;

      navigateTo(nextId);

      if (isOther && menuPanelElement) {
        // Restart quick animation on the menu panel.
        menuPanelElement.classList.remove("screen-menu-animating");
        // Force reflow to allow re-adding the class.
        // eslint-disable-next-line no-unused-expressions
        menuPanelElement.offsetWidth;
        menuPanelElement.classList.add("screen-menu-animating");

        // Close menu shortly after animation so эффект встигне відобразитися.
        window.setTimeout(() => {
          closeMenu();
        }, 160);
      } else {
        closeMenu();
      }
      return;
    }

    if (target.hasAttribute("data-screen-menu-close")) {
      closeMenu();
    }
  });

  // Ensure initial screen is visible.
  navigateTo(currentScreenId);
}

/**
 * Changes active screen by id and updates header text.
 * Переключает активный экран по идентификатору и обновляет заголовок.
 * @param {string} screenId - One of SCREEN_IDS.
 */
export function navigateTo(screenId) {
  if (!SCREEN_IDS.includes(screenId)) return;

  currentScreenId = screenId;

  for (const id of SCREEN_IDS) {
    const el = $(`screen-${id}`);
    if (!el) continue;
    if (id === currentScreenId) el.classList.remove("screenHidden");
    else el.classList.add("screenHidden");
  }

  // Highlight active menu item if menu is present.
  if (menuElement) {
    const items = menuElement.querySelectorAll("[data-screen]");
    items.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (btn.dataset.screen === currentScreenId) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
  }

  const titleEl = $("title");
  if (!titleEl) return;

  switch (currentScreenId) {
    case "main":
      titleEl.textContent = "Звіт по БПЛА";
      break;
    case "journal":
      titleEl.textContent = "Журнал та статистика";
      break;
    case "settings":
      titleEl.textContent = "Налаштування списків";
      break;
    case "help":
      titleEl.textContent = "Довідка та контакти";
      break;
    default:
      titleEl.textContent = "Звіт по БПЛА";
      break;
  }
}

