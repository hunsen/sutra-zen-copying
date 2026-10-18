/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'ZenKai',
          'Kaiti TC',
          'BiauKai',
          'DFKai-SB',
          'TW-MOE-Std-Kai',
          'Kaiti SC',
          'STKaiti',
          'KaiTi',
          'Noto Serif TC',
          'Noto Serif SC',
          'SimSun',
          'serif',
        ],
        sans: [
          'PingFang TC',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        seal: [
          'AncientSeal',
          'Chong Xi Small Seal',
          '崇羲篆體',
          '崇羲篆体',
          'SealScript',
          'serif',
        ],
      },
      opacity: {
        98: '0.98',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe-gold': 'breatheGold 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        breatheGold: {
          '0%, 100%': {
            boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.4), 0 0 16px rgba(212, 175, 55, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 0 3px rgba(212, 175, 55, 0.85), 0 0 24px rgba(212, 175, 55, 0.5)',
          },
        },
      },
    },
  },
  plugins: [],
};
