/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1d4ed8",
          dark: "#1e3a8a",
          ink: "#0f172a",
        },
        risk: {
          low: "#16a34a",
          moderate: "#eab308",
          high: "#f97316",
          extreme: "#dc2626",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.08)",
        lift: "0 4px 12px rgba(15,23,42,0.10)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};