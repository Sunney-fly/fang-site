import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a6ff',
          500: '#2f86f6',
          600: '#1a67e3',
          700: '#1652b8',
          800: '#174592',
          900: '#183c78',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 4px 16px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
};

export default config;
