/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        ready: {
          DEFAULT: '#10b981',
          bg: '#ecfdf5',
          border: '#a7f3d0',
          text: '#065f46',
        },
        atrisk: {
          DEFAULT: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#92400e',
        },
        delayed: {
          DEFAULT: '#ef4444',
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#991b1b',
        },
        upcoming: {
          DEFAULT: '#64748b',
          bg: '#f8fafc',
          border: '#e2e8f0',
          text: '#334155',
        },
        nodata: {
          DEFAULT: '#94a3b8',
          bg: '#f1f5f9',
          border: '#cbd5e1',
          text: '#475569',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
};
