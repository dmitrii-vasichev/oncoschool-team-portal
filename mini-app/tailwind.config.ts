import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: "var(--tg-theme-bg-color, #ffffff)",
          text: "var(--tg-theme-text-color, #000000)",
          hint: "var(--tg-theme-hint-color, #999999)",
          link: "var(--tg-theme-link-color, #2481cc)",
          button: "var(--tg-theme-button-color, #2481cc)",
          "button-text": "var(--tg-theme-button-text-color, #ffffff)",
          "secondary-bg": "var(--tg-theme-secondary-bg-color, #f0f0f0)",
          "header-bg": "var(--tg-theme-header-bg-color, #ffffff)",
          "section-bg": "var(--tg-theme-section-bg-color, #ffffff)",
          accent: "var(--tg-theme-accent-text-color, #2481cc)",
          destructive: "var(--tg-theme-destructive-text-color, #ff3b30)",
          subtitle: "var(--tg-theme-subtitle-text-color, #999999)",
          "section-header":
            "var(--tg-theme-section-header-text-color, #6d6d72)",
          separator: "var(--tg-theme-section-separator-color, #c8c7cc)",
        },
      },
      keyframes: {
        pageIn: {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pageIn: "pageIn 200ms ease-out",
        fadeInUp: "fadeInUp 200ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
