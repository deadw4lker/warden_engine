/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: '#F2EFE9',
        card: '#FFFFFF',
        line: '#E6E0D3',
        ink: '#1C1917',
        warden: {
          dark: '#F2EFE9',
          panel: '#FFFFFF',
          surface: '#FFFFFF',
          border: '#E6E0D3',
          primary: '#1C1917',
          danger: '#B91C1C',
          warning: '#92400E',
          success: '#166534',
          accent: '#9A3412'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
