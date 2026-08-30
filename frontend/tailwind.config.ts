import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // War_Room palette
        navy: {
          DEFAULT: "#0A172F",
          50: "#E6E8EC",
          100: "#B7BEC9",
          200: "#8790A4",
          300: "#576378",
          400: "#2A3A5A",
          500: "#0A172F",
          600: "#081227",
          700: "#060E1E",
          800: "#040914",
          900: "#02050B",
        },
        mint: {
          DEFAULT: "#80FFE8",
          50: "#EBFFFA",
          100: "#D6FFF5",
          200: "#ADFFEB",
          300: "#80FFE8",
          400: "#4DEAD0",
          500: "#2DBFA7",
          600: "#22948170",
          700: "#17685B",
        },
        teal: {
          DEFAULT: "#72B6C9",
          muted: "#497784",
        },
        // 設計規範 02 Color — Functional
        // danger 與規範的 Error Red 同值,保留原名避免動到既有用法。
        danger: "#FF5F5A",
        warning: "#FFC56B",
        // ⚠ 規範文件「待確認 2」:Success 的 CSS 色票是 #80FFE8,
        //   截圖標註是 #72B6C9。這裡沿用專案既有的 #72B6C9,等設計師確認
        //   後再改 —— 不要在未確認前無聲改掉既有用法的顏色。
        success: "#72B6C9",
        // DUT type accents (kept for backward compat, tuned for dark bg)
        smo: { DEFAULT: "#80FFE8", 50: "#0E2235", 100: "#14324E" },
        ric: { DEFAULT: "#72B6C9", 50: "#0F2A32", 100: "#163A44" },
        xapp: { DEFAULT: "#B490FF", 50: "#1F1735", 100: "#2C224D" },
        rapp: { DEFAULT: "#FFC56B", 50: "#2A2010", 100: "#3D2E16" },
        // Primary Button 文字 / Toggle 圓鈕(規範 02)
        "dark-text": "#132951",
      },
      borderRadius: {
        // rem so they scale with the root font-size — same visual softness
        // in both regular mode (1rem=16px → 21px / 14px) and wall mode
        // (1rem=48px → 63px / 42px). Otherwise px values look proportionally
        // sharper on the much-larger wall canvas.
        section: "1.3125rem",
        item: "0.875rem",
      },
      fontFamily: {
        // 設計規範 01:Figma Text Style 實際套用 PingFang TC,說明頁寫
        // Noto Sans TC。依規範建議兩者都列,Noto 優先。
        sans: ['"Noto Sans TC"', '"PingFang TC"', "system-ui", "-apple-system", "sans-serif"],
      },
      backgroundImage: {
        "navy-gradient":
          "linear-gradient(92deg, rgba(73,119,132,0.40) 14%, rgba(10,23,47,0.40) 83%)",
      },
      boxShadow: {
        "mint-glow": "0 0 24px rgba(128,255,232,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
