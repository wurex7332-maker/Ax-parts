/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8',
        },
        line: '#e2e8f0',
        canvas: '#f6f8fb',
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          500: '#2f5fd0',
          600: '#254cb0',
          700: '#1d3d8f',
        },
        // 三态：浅底 + 深字，保证 AA 对比度（PRD §7.1）
        normal: { bg: '#e7f6ed', fg: '#11643a', bd: '#9dd7b6' },
        low: { bg: '#fdf3e0', fg: '#8a5300', bd: '#f0cb8a' },
        stockout: { bg: '#fdeceb', fg: '#9c1c14', bd: '#f0a9a3' },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      maxWidth: {
        page: '1440px',
      },
    },
  },
  plugins: [],
};
