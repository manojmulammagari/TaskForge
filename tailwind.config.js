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
        // Tactile Swiss Instrumentation palette
        calm: {
          bg: "#FAF8F5",        // warm alabaster
          surface: "#FFFFFF",
          border: "#E7E2D6",
          text: "#2D2B26",
          muted: "#6E6659",
        },
        focus: {
          bg: "#0B0D11",        // deep obsidian
          surface: "#12141A",
          border: "#2A2F3A",
          text: "#E7E9EE",
          muted: "#94A0B4",
        },
        // Keep the full Tailwind scales so utilities such as bg-amber-500,
        // text-emerald-400, and their opacity variants resolve correctly.
        amber: { ...defaultColors.amber, DEFAULT: "#F59E0B" },
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
