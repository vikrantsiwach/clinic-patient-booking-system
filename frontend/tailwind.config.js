/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     '#0D1117',
        teal:    { DEFAULT: '#0A7B6C', light: '#E6F4F1', mid: '#B2DDD7' },
        amber:   '#D97706',
        surface: '#F7F9F8',
        border:  '#E2E8E6',
        muted:   '#6B7A76',
        label:   '#3D4E49',
        pill:    '#EEF7F5',
        orange:  { DEFAULT: '#EA580C', light: '#FFF7ED', mid: '#FED7AA' },
        purple:  { DEFAULT: '#7C3AED', light: '#F3E8FF' },
      },
      fontFamily: {
        sans:  ['"DM Sans"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(10,123,108,.08), 0 1px 3px rgba(0,0,0,.06)',
        'card-lg': '0 8px 32px rgba(10,123,108,.12), 0 2px 8px rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
};
