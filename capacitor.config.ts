import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.johmacos.secretary',
  appName: 'Secretary',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
