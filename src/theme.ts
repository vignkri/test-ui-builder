import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "der-monitor-theme";

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // storage unavailable (private mode, blocked site data) — fall through to the system theme
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light / Dark theme per the design's Theme collection; `.dark` on <html> swaps every token. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not persisted; the toggle still applies for this visit
    }
    setTheme(next);
  };

  return [theme, toggle];
}
