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
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-slow': 'pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe-gold': 'breatheGold 2.8s ease-in-out infinite',
        'float-slow': 'floatSlow 8s ease-in-out infinite',
        'shimmer-gold': 'shimmerGold 3.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        breatheGold: {
          '0%, 100%': {
            boxShadow: '0 0 0 1.5px rgba(212, 175, 55, 0.45), 0 0 14px rgba(212, 175, 55, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 0 2.5px rgba(212, 175, 55, 0.9), 0 0 26px rgba(212, 175, 55, 0.55)',
          },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmerGold: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.85' },
        },
      },
    },
  },
  plugins: [],
};
