/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060B18',
          900: '#0A1628',
          800: '#0F2040',
          700: '#162B56',
          600: '#1E3A6E',
        },
        amber: {
          400: '#FBC02D',
          500: '#F9A825',
          600: '#F57F17',
        },
        slate: {
          850: '#1A2332',
        }
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
