function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readSessionCache(key, fallback) {
  if (!canUseSessionStorage()) return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionCache(key, value) {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}
