/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e3f2fd",
          100: "#bbdefb",
          200: "#90caf9",
          300: "#64b5f6",
          400: "#42a5f5",
          500: "#2196f3",
          600: "#1976d2",
          700: "#1565c0",
          800: "#0d47a1",
          900: "#0a3d91",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#F97316",
          600: "#EA6C0A",
          700: "#C2540A",
          800: "#9A420D",
          900: "#7C370E",
        },
        sky2: "#42A5F5",
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
          "linear-gradient(90deg, #1976D2 0%, #1976D2 42%, #F97316 100%)",
        "brand-gradient-br":
          "linear-gradient(135deg, #1976D2 0%, #42A5F5 40%, #F97316 100%)",
        "logo-gradient": "linear-gradient(135deg, #1976D2 0%, #F97316 100%)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(25, 118, 210, 0.12), 0 4px 16px -4px rgba(25, 118, 210, 0.10)",
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px -12px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
