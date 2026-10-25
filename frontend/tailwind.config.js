/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        ink: "var(--text)",
        muted: "var(--text-secondary)",
        faint: "var(--text-faint)",
        line: "var(--border)",
        brand: { DEFAULT: "var(--brand-500)", 400: "var(--brand-400)", 600: "var(--brand-600)", 50: "var(--brand-50)" },
        gold: { DEFAULT: "var(--gold)", soft: "var(--gold-soft)" },
        ok: "var(--success-text)",
        warn: "var(--warning-text)",
        err: "var(--error-text)",
      },
      fontFamily: {
        display: ["'Sora'", "system-ui", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(155 70% 45% / .35), 0 8px 32px -8px hsl(155 80% 40% / .35)",
        card: "0 1px 0 hsl(0 0% 100% / .04) inset, 0 12px 32px -16px rgb(0 0 0 / .6)",
      },
    },
  },
  plugins: [],
};
