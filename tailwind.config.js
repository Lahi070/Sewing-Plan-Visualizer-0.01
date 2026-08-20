/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060B18', // Deepest background
          900: '#0B132B', // Main dark canvas
          850: '#101B3B', // Card surfaces
          800: '#16234D', // Card hover / elevated
          750: '#1C2C5E', // Active borders / highlights
          700: '#233670', // Subtle borders
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        ready: {
          DEFAULT: '#10b981',
          bg: '#022c22',
          border: '#059669',
          text: '#34d399',
        },
        atrisk: {
          DEFAULT: '#f59e0b',
          bg: '#451a03',
          border: '#d97706',
          text: '#fbbf24',
        },
        delayed: {
          DEFAULT: '#f43f5e',
          bg: '#4c0519',
          border: '#e11d48',
          text: '#fb7185',
        },
        upcoming: {
          DEFAULT: '#38bdf8',
          bg: '#082f49',
          border: '#0284c7',
          text: '#7dd3fc',
        },
        nodata: {
          DEFAULT: '#94a3b8',
          bg: '#0f172a',
          border: '#334155',
          text: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'navy-glow': '0 0 25px -5px rgba(30, 58, 138, 0.35)',
        'emerald-glow': '0 0 20px -3px rgba(16, 185, 129, 0.3)',
        'amber-glow': '0 0 20px -3px rgba(245, 158, 11, 0.3)',
        'rose-glow': '0 0 20px -3px rgba(244, 63, 94, 0.3)',
        'cyan-glow': '0 0 20px -3px rgba(56, 189, 248, 0.3)',
      }
    },
  },
  plugins: [],
};
