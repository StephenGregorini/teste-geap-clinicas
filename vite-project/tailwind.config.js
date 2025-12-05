/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        medblue: "#0c77e1",
        meddark: "#0f1424",
        medwhite: "#ffffff",
      },
    },
  },
  plugins: [],
};
