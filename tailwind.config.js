/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bleu principal (logo Easy Dunya)
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b9fe0",
          600: "#1e88d6",
          700: "#1769b3",
          800: "#15528c",
          900: "#143f6b",
        },
        // Orange accent (logo Easy Dunya)
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea6c0a",
          700: "#c2540a",
          800: "#9a420d",
          900: "#7c370e",
        },
        sky2: "#0ea5e9",
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        ar: ["Cairo", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(90deg, #1e88d6 0%, #2f8fd0 40%, #f97316 100%)",
        "brand-gradient-br":
          "linear-gradient(135deg, #1e88d6 0%, #3b9fe0 45%, #f97316 100%)",
        "logo-gradient": "linear-gradient(135deg, #2aa4c4 0%, #f97316 100%)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(30, 136, 214, 0.10), 0 4px 16px -4px rgba(30, 136, 214, 0.10)",
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px -12px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
