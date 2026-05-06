/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#fdda36',
        secondary: '#514163',
      },
      fontFamily: {
        'heading': ['Krona One', 'sans-serif'],
        'body': ['Jost', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'slide-up': {
          from: {
            opacity: '0',
            transform: 'translateY(100px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slideUp': {
          from: {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slide-in': {
          from: {
            opacity: '0',
            transform: 'translateX(100px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out',
        'slideUp': 'slideUp 0.15s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
