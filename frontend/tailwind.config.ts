import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#0A1628',
          secondary: '#0D1F35',
          elevated:  '#122040',
          card:      '#0F1E33',
        },
        accent: {
          teal:  '#00C8A0',
          gold:  '#D4A843',
        },
        border: {
          DEFAULT: '#1E3A5A',
          focus:   '#00C8A0',
        },
        text: {
          primary:   '#FFFFFF',
          secondary: '#8DA5C0',
          muted:     '#4A6480',
        },
      },
      fontFamily: {
        display: ['Be Vietnam Pro', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        btn:  '8px',
      },
    },
  },
  plugins: [],
} satisfies Config