/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        relay: {
          950: '#070A10', // Deepest background
          900: '#0C111C', // Dark navy/charcoal canvas
          850: '#111726', // Elevated panels
          800: '#161F33', // Card surface
          750: '#1C2740', // Hover / active card
          700: '#263454', // Border subtle
          600: '#354871', // Border strong
          400: '#7E92B9', // Secondary text
          300: '#A4B5D4', // Subtitle text
          100: '#E2E8F0', // Light text
          50: '#F8FAFC', // Crisp white
        },
        brand: {
          DEFAULT: '#3B82F6', // Blue-500
          hover: '#2563EB', // Blue-600
          light: '#60A5FA', // Blue-400
          glow: 'rgba(59, 130, 246, 0.25)',
        },
        ai: {
          DEFAULT: '#8B5CF6', // Purple-500
          accent: '#A78BFA', // Purple-400
          glow: 'rgba(139, 92, 246, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-brand': '0 0 30px -5px rgba(59, 130, 246, 0.3)',
        'glow-ai': '0 0 30px -5px rgba(139, 92, 246, 0.3)',
        'card-dark': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
