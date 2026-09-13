/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Michroma', 'sans-serif'],
        display: ['Michroma', 'sans-serif'],
        mono: ['Michroma', 'monospace'],
      },
      colors: {
        gold: {
          300: "#ffdf85",
          400: "#e5c068",
          500: "#d4af37",
          700: "#a37f19",
          900: "#473600",
        },
        darkSurface: "#0b0b0d",
      },
      boxShadow: {
        "gold-glow": "0 0 30px -5px rgba(212, 175, 55, 0.35)",
        "bullet-glow": "0 0 20px 4px rgba(212, 175, 55, 0.6)",
      },
    },
  },
  plugins: [],
};