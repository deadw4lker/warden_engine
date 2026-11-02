/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.35rem' }],
        sm: ['1rem', { lineHeight: '1.5rem' }],
      },
      colors: {
        paper: '#F4F7FA',
        card: '#FFFFFF',
        line: '#DCE6EC',
        ink: '#1C1917',
        warden: {
          dark: '#F4F7FA',
          panel: '#FFFFFF',
          surface: '#FFFFFF',
          border: '#DCE6EC',
          primary: '#2F7182',
          danger: '#B91C1C',
          warning: '#92400E',
          success: '#166534',
          accent: '#4B91A0'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['Consolas', '"Courier New"', 'monospace'],
      }
    },
  },
  plugins: [],
}
