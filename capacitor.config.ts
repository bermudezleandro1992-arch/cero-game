import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.mimensajero.app',
  appName: 'Mi Mensajero',
  webDir: 'dist',
  server: {
    url: 'https://mimensajero.vercel.app',
    cleartext: false,
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
