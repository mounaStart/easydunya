/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        sand: {
          50: "#fdf8f3",
          100: "#f9ecdc",
          200: "#f1d3b0",
          300: "#e6b27c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        ar: ["Cairo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(15, 118, 110, 0.10), 0 4px 16px -4px rgba(15, 118, 110, 0.10)",
      },
    },
  },
  plugins: [],
};
