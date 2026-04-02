/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19', // Dark background
        surface: '#1A1F2C', // Card background
        primary: '#3B82F6', // Brand blue
        accent: '#8B5CF6', // Purple accent
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(28px, -24px) scale(1.06)' },
          '66%': { transform: 'translate(-22px, 16px) scale(0.94)' },
        },
        gridPulse: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        fadeIn: 'fadeIn 1.2s ease-out forwards',
        blob: 'blob 20s ease-in-out infinite',
        'blob-slow': 'blob 28s ease-in-out infinite',
        'blob-delay': 'blob 24s ease-in-out infinite 3s',
        gridPulse: 'gridPulse 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

