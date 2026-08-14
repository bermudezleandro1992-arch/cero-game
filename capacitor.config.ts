import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.mimensajero.app',
  appName: 'Mi Mensajero',
  webDir: 'dist',
  server: {
    // For production: remove this and use bundled dist
    // androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    backgroundColor: '#05080A',
  },
}

export default config
