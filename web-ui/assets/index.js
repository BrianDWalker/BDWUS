// Index page script: resolve the current user display name for the welcome banner.
// This does not implement full Microsoft authentication, but it does use the configuration
// object when a real identity is provided by the hosting environment.

(function () {
  const config = window.APP_CONFIG || {};

  function getConfiguredUserName() {
    const user = config.user || {};
    if (user.displayName && String(user.displayName).trim()) {
      return String(user.displayName).trim();
    }
    if (user.email && String(user.email).trim()) {
      return String(user.email).trim();
    }
    return null;
  }

  function getStoredUserName() {
    try {
      return window.localStorage.getItem("userDisplayName") || null;
    } catch (_error) {
      return null;
    }
  }

  function resolveWelcomeName() {
    // Priority order:
    // 1) user object provided by config (strongest source)
    // 2) locally stored display name (optional developer fallback)
    // 3) generic Guest fallback.
    const configured = getConfiguredUserName();
    if (configured) return configured;
    const stored = getStoredUserName();
    if (stored && stored.trim()) return stored.trim();
    return "Guest";
  }

  function setWelcomeName() {
    const welcomeElement = document.getElementById("welcomeName");
    if (!welcomeElement) return;
    welcomeElement.textContent = resolveWelcomeName();
  }

  document.addEventListener("DOMContentLoaded", setWelcomeName);
})();
