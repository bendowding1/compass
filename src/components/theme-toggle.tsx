"use client";

/**
 * Sun/moon theme switch. The effective theme follows the OS preference until a
 * click pins an explicit choice ("light" | "dark") in localStorage, which the
 * inline script in layout.tsx re-applies before first paint on later visits.
 * The visible icon is selected by CSS from the effective theme, so this
 * component renders identically on server and client.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      onClick={() => {
        const root = document.documentElement;
        const explicit = root.dataset.theme;
        const dark = explicit
          ? explicit === "dark"
          : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
        const next = dark ? "light" : "dark";
        root.dataset.theme = next;
        try {
          localStorage.setItem("compass-theme", next);
        } catch {
          // private mode etc. — the choice still applies for this page view
        }
      }}
    >
      <span className="moon" aria-hidden>
        {"☾"}
      </span>
      <span className="sun" aria-hidden>
        {"☀"}
      </span>
    </button>
  );
}
