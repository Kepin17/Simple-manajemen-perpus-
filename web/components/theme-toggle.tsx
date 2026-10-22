"use client";

import { useState } from "react";

// Tema awal dipasang oleh script di layout (localStorage lalu prefers-color-scheme).
function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(currentTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Penyimpanan diblokir: tema tetap berlaku untuk sesi ini.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      className="rounded-md px-3 py-2 text-ink hover:bg-surface"
    >
      {theme === "dark" ? "Terang" : "Gelap"}
    </button>
  );
}
