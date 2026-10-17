import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.sutrazen',
  appName: '静心抄经',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#16212E',
  },
  ios: {
    backgroundColor: '#16212E',
  },
};

export default config;
