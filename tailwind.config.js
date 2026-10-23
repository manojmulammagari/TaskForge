/** @type {import('tailwindcss').Config} */
const defaultColors = require("tailwindcss/colors");

module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        swiss: {
          bg: "var(--swiss-bg)",
          surface: "var(--swiss-surface)",
          border: "var(--swiss-border)",
          text: "var(--swiss-text)",
          muted: "var(--swiss-muted)",
          ink: "var(--swiss-ink)",
        },
        calm: {
          bg: "#FAF8F5",
          surface: "#FFFFFF",
          border: "#E7E2D6",
          text: "#2D2B26",
          muted: "#6E6659",
        },
        focus: {
          bg: "#0B0D11",
          surface: "#12141A",
          border: "#2A2F3A",
          text: "#E7E9EE",
          muted: "#94A0B4",
        },
        // WCAG AAA compliant amber for dark mode (#0B0D11 bg)
        // amber-300 (#FCD34D) = 14.8:1 contrast on #0B0D11
        // amber-400 (#FBBF24) = 11.5:1 contrast on #0B0D11
        amber: { 
          ...defaultColors.amber, 
          DEFAULT: "#F59E0B",
          300: "#FCD34D",
          400: "#FBBF24",
        },
        emerald: { ...defaultColors.emerald, DEFAULT: "#10B981" },
        telemetry: {
          dim: "#4B5563",
          base: "#E5E7EB",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "telemetry-xs": ["0.75rem", { lineHeight: "1.125", fontFamily: "var(--font-mono)" }],
        "telemetry-sm": ["0.875rem", { lineHeight: "1.25", fontFamily: "var(--font-mono)" }],
        "telemetry-base": ["1rem", { lineHeight: "1.375", fontFamily: "var(--font-mono)" }],
      },
      borderRadius: {
        instrument: "6px",
        card: "10px",
      },
      boxShadow: {
        "swiss": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "swiss-dark": "0 1px 3px 0 rgb(0 0 0 / 0.8), 0 1px 2px -1px rgb(0 0 0 / 0.6)",
      },
    },
  },
  plugins: [],
};