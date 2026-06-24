/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        canvas: "#101010",
        "canvas-soft": "#1a1a1a",
        hairline: "#3d3a39",
        "hairline-dim": "#2a2827",
        primary: {
          DEFAULT: "#00d992",
          soft: "#2fd6a1",
          deep: "#10b981",
        },
        ink: {
          DEFAULT: "#f2f2f2",
          strong: "#ffffff",
        },
        body: "#bdbdbd",
        mute: "#8b949e",
        faction: {
          rohan: "#5ecb6b",
          "rohan-deep": "#2d6a35",
          isengard: "#e05555",
          "isengard-deep": "#8b1a1a",
        },
        stat: {
          good: "#5ecb6b",
          warn: "#c8941a",
          bad: "#e05555",
        },
        contested: {
          DEFAULT: "#c8941a",
          deep: "#8b6914",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
      },
    },
  },
  plugins: [],
};
