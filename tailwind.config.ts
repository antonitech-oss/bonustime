import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0A0F1E",
        "bg-card":    "#111827",
        "bg-sidebar": "#111827",
        "bg-hover":   "#1E2640",
        "bg-deep":    "#0D1428",
        bord:         "#1E2640",
        "txt-primary":   "#E2E8FF",
        "txt-secondary": "#8892B0",
        lime:         "#34D399",
        violet:       "#4F46E5",
        "violet-dark":"#3730A3",
        "violet-l":   "#818CF8",
        "acc-yellow": "#F59E0B",
        "acc-red":    "#F87171",
        "acc-blue":   "#818CF8",
        teal:         "#34D399",
      },
      borderRadius: { card: "8px" },
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"],
        body:    ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
export default config;
