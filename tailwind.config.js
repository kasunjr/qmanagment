module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Tenant theme colors, set as CSS variables by lib/theme-style.ts.
      colors: {
        theme: {
          primary: "rgb(var(--qm-primary) / <alpha-value>)",
          "on-primary": "rgb(var(--qm-on-primary) / <alpha-value>)",
          secondary: "rgb(var(--qm-secondary) / <alpha-value>)",
          "on-secondary": "rgb(var(--qm-on-secondary) / <alpha-value>)",
          bg: "rgb(var(--qm-bg) / <alpha-value>)",
          surface: "rgb(var(--qm-surface) / <alpha-value>)",
          text: "rgb(var(--qm-text) / <alpha-value>)",
        },
      },
      borderRadius: {
        theme: "var(--qm-radius)",
        "theme-lg": "calc(var(--qm-radius) * 1.5)",
      },
    },
  },
  plugins: [],
};